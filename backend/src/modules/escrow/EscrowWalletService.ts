import type { PackageShipment } from '../../types/index.ts';

export interface WalletAccount {
  userId: string;
  userName: string;
  balanceTwd: number;
  lockedEscrowTwd: number;
}

export interface EscrowTransaction {
  id: string;
  shipmentId: string;
  senderId: string;
  travelerId: string;
  totalAmountTwd: number;
  travelerEarningsTwd: number;
  platformCommissionTwd: number;
  status: 'HELD_IN_ESCROW' | 'RELEASED_TO_TRAVELER' | 'REFUNDED_TO_SENDER';
  createdAt: string;
  settledAt?: string;
}

export class EscrowWalletService {
  private wallets: Map<string, WalletAccount> = new Map();
  private escrowTransactions: Map<string, EscrowTransaction> = new Map();
  private platformTotalRevenueTwd = 0;

  public getOrCreateWallet(userId: string, userName: string, initialBalance = 2000): WalletAccount {
    if (!this.wallets.has(userId)) {
      this.wallets.set(userId, {
        userId,
        userName,
        balanceTwd: initialBalance,
        lockedEscrowTwd: 0,
      });
    }
    return this.wallets.get(userId)!;
  }

  /**
   * 鎖定寄件人款項進入平台資金託管 (Escrow)
   */
  public holdEscrowForShipment(shipment: PackageShipment): EscrowTransaction {
    const senderWallet = this.getOrCreateWallet(shipment.senderId, shipment.senderName);
    const amount = shipment.pricingQuote.totalAmount;

    if (senderWallet.balanceTwd < amount) {
      throw new Error(`寄件人帳戶餘額不足 (餘額: $${senderWallet.balanceTwd}, 需支付: $${amount})`);
    }

    // 扣除寄件人可用餘額，轉入鎖定託管金
    senderWallet.balanceTwd -= amount;
    senderWallet.lockedEscrowTwd += amount;

    const escrowTx: EscrowTransaction = {
      id: `ESC_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      shipmentId: shipment.id,
      senderId: shipment.senderId,
      travelerId: shipment.assignedTravelerId || '',
      totalAmountTwd: amount,
      travelerEarningsTwd: shipment.pricingQuote.travelerEarnings,
      platformCommissionTwd: shipment.pricingQuote.platformCommission,
      status: 'HELD_IN_ESCROW',
      createdAt: new Date().toISOString(),
    };

    this.escrowTransactions.set(shipment.id, escrowTx);
    return escrowTx;
  }

  /**
   * 包裹安全簽收送達，解鎖資金並分帳至旅人錢包
   */
  public releaseEscrowToTraveler(shipment: PackageShipment): {
    travelerEarnings: number;
    platformCommission: number;
  } {
    const escrowTx = this.escrowTransactions.get(shipment.id);
    if (!escrowTx) {
      throw new Error(`找不到訂單 [${shipment.id}] 之託管交易紀錄`);
    }

    if (escrowTx.status !== 'HELD_IN_ESCROW') {
      throw new Error(`託管交易狀態為 [${escrowTx.status}]，不可重複結算`);
    }

    const senderWallet = this.getOrCreateWallet(shipment.senderId, shipment.senderName);
    const travelerWallet = this.getOrCreateWallet(
      shipment.assignedTravelerId || 'unknown_traveler',
      '順路旅人'
    );

    // 解除寄件人鎖定金額
    senderWallet.lockedEscrowTwd -= escrowTx.totalAmountTwd;

    // 將收益發放給旅人
    travelerWallet.balanceTwd += escrowTx.travelerEarningsTwd;

    // 平台計入抽成佣金
    this.platformTotalRevenueTwd += escrowTx.platformCommissionTwd;

    escrowTx.status = 'RELEASED_TO_TRAVELER';
    escrowTx.settledAt = new Date().toISOString();

    return {
      travelerEarnings: escrowTx.travelerEarningsTwd,
      platformCommission: escrowTx.platformCommissionTwd,
    };
  }

  /**
   * 取消訂單，全額退款回寄件人帳戶
   */
  public refundEscrowToSender(shipmentId: string): void {
    const escrowTx = this.escrowTransactions.get(shipmentId);
    if (!escrowTx || escrowTx.status !== 'HELD_IN_ESCROW') {
      return;
    }

    const senderWallet = this.wallets.get(escrowTx.senderId);
    if (senderWallet) {
      senderWallet.lockedEscrowTwd -= escrowTx.totalAmountTwd;
      senderWallet.balanceTwd += escrowTx.totalAmountTwd;
    }

    escrowTx.status = 'REFUNDED_TO_SENDER';
    escrowTx.settledAt = new Date().toISOString();
  }

  public getPlatformRevenue(): number {
    return this.platformTotalRevenueTwd;
  }
}
