import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { InMemoryStore } from './database/InMemoryStore.ts';
import { CorridorMatchingEngine } from './modules/matching/CorridorMatchingEngine.ts';
import { ComplianceAndSafetyModule } from './modules/compliance/ComplianceAndSafetyModule.ts';
import { PricingEngine } from './modules/pricing/PricingEngine.ts';
import { EscrowWalletService } from './modules/escrow/EscrowWalletService.ts';
import { MAJOR_HUBS } from './database/StationHubs.ts';
import type { Itinerary, PackageShipment, TransportMode } from './types/index.ts';

const store = new InMemoryStore();
const escrowService = new EscrowWalletService();

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data, null, 2));
}

export function createServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method;

    // 處理 CORS Preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    try {
      // 0. 首頁與 PWA 靜態資產服務 (Web 原型、manifest、Service Worker、圖標)
      if ((pathname === '/' || pathname === '/index.html' || pathname === '/prototype') && method === 'GET') {
        const publicHtmlPath = path.resolve('public/index.html');
        if (fs.existsSync(publicHtmlPath)) {
          const htmlContent = fs.readFileSync(publicHtmlPath, 'utf-8');
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          });
          return res.end(htmlContent);
        }
      }

      // 0.1 PWA 靜態檔案支援
      if (method === 'GET' && pathname.match(/^\/(manifest\.json|sw\.js|icon-\d+\.png)$/)) {
        const filePath = path.resolve('public', pathname.slice(1));
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath);
          const mimeTypes: Record<string, string> = {
            '.json': 'application/manifest+json; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.png': 'image/png',
          };
          res.writeHead(200, {
            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*',
          });
          return res.end(fs.readFileSync(filePath));
        }
      }

      // 0.2 App Store / Google Play 審查必備：隱私權政策與服務協議
      if ((pathname === '/privacy' || pathname === '/terms') && method === 'GET') {
        const isPrivacy = pathname === '/privacy';
        const docTitle = isPrivacy ? '平台隱私權保護政策 (Privacy Policy)' : '使用者服務與快遞媒合協議 (Terms of Service)';
        const docBody = isPrivacy
          ? '本平台依法保護用戶個人資料。收集資訊包含：手機號碼（用於雙重 OTP 驗證）、位置座標（用於時空走廊順路比對）、驗視存證照片（用於開箱合規檢驗）。所有資料均採傳輸加密與最小權限原則管理。'
          : '本平台提供大眾交通與私家載具順路捎帶快遞媒合服務。旅人與寄件人均需遵循違禁品法令規範，所有交易由平台資金託管（Escrow）系統保護，憑雙重動態 OTP 驗收解鎖。';
        const legalHtml = `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${docTitle}</title><script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script></head><body class="bg-slate-900 text-slate-100 p-6 md:p-12 max-w-3xl mx-auto space-y-6"><div class="border-b border-slate-700 pb-4"><h1 class="text-2xl font-bold text-blue-400">${docTitle}</h1><p class="text-slate-400 text-sm mt-1">版本: 1.0.0 ｜ 生效日期: 2026年10月</p></div><div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 leading-relaxed text-slate-300 space-y-4"><p>${docBody}</p><p class="text-xs text-slate-400">專為 Google Play 與 Apple App Store 行動應用程式合規審查設置。</p></div><a href="/" class="inline-block text-blue-400 hover:underline text-sm">← 返回順路快遞平台</a></body></html>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(legalHtml);
      }

      // 1. 健康檢查
      if (pathname === '/health' && method === 'GET') {
        return sendJson(res, 200, {
          status: 'ok',
          service: 'Multi-Modal Crowdsourced Courier Platform API',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        });
      }

      // 2. 取得大眾運輸與航空樞紐站點
      if (pathname === '/api/hubs' && method === 'GET') {
        return sendJson(res, 200, { success: true, data: MAJOR_HUBS });
      }

      // 3. 取得所有旅客行程
      if (pathname === '/api/itineraries' && method === 'GET') {
        return sendJson(res, 200, { success: true, data: store.getAllItineraries() });
      }

      // 4. 發布新旅客行程
      if (pathname === '/api/itineraries' && method === 'POST') {
        const body = await parseJsonBody(req);
        const itinerary: Itinerary = {
          id: `ITIN_${Date.now()}`,
          travelerId: body.travelerId || 'USR_ANON_TRAVELER',
          travelerName: body.travelerName || '順路旅客',
          travelerPhone: body.travelerPhone || '0900-000-000',
          travelerRating: 5.0,
          isKycVerified: Boolean(body.isKycVerified ?? true),
          transportMode: body.transportMode || 'HSR',
          tripNumber: body.tripNumber,
          origin: body.origin,
          destination: body.destination,
          departureTime: body.departureTime,
          arrivalTime: body.arrivalTime,
          capacity: body.capacity,
          maxDetourKm: body.maxDetourKm || 3.0,
          status: 'PLANNED',
          createdAt: new Date().toISOString(),
        };
        store.saveItinerary(itinerary);
        return sendJson(res, 201, { success: true, data: itinerary });
      }

      // 5. 費用試算報價
      if (pathname === '/api/quote' && method === 'POST') {
        const body = await parseJsonBody(req);
        const quote = PricingEngine.calculateQuote({
          transportMode: body.transportMode || 'MRT',
          distanceKm: body.distanceKm || 10,
          weightKg: body.weightKg || 1,
          declaredValueTwd: body.declaredValueTwd || 1000,
          isInternational: Boolean(body.isInternational),
        });
        return sendJson(res, 200, { success: true, data: quote });
      }

      // 6. 取得所有包裹需求
      if (pathname === '/api/shipments' && method === 'GET') {
        return sendJson(res, 200, { success: true, data: store.getAllShipments() });
      }

      // 7. 發布新包裹運送需求 (含違禁品檢測)
      if (pathname === '/api/shipments' && method === 'POST') {
        const body = await parseJsonBody(req);

        // 違禁品與航空安全安全過濾
        const isInternational = body.isInternational || false;
        const checkResult = ComplianceAndSafetyModule.checkContraband(
          body.title || '',
          body.description || '',
          body.category || 'OTHER',
          isInternational
        );

        if (!checkResult.isAllowed) {
          return sendJson(res, 400, {
            success: false,
            error: 'CONTRABAND_DETECTED',
            message: '系統安全風控拒絕：包含禁止攜帶或未檢疫違禁品',
            violations: checkResult.violations,
          });
        }

        const quote = PricingEngine.calculateQuote({
          transportMode: body.transportModePreference || 'HSR',
          distanceKm: body.distanceKm || 100,
          weightKg: body.weightKg || 1,
          declaredValueTwd: body.declaredValue || 1000,
          isInternational,
        });

        const shipment: PackageShipment = {
          id: `PKG_${Date.now()}`,
          senderId: body.senderId || 'USR_SENDER_DEFAULT',
          senderName: body.senderName || '寄件人',
          senderPhone: body.senderPhone || '0911-000-000',
          recipientName: body.recipientName || '收件人',
          recipientPhone: body.recipientPhone || '0922-000-000',
          title: body.title,
          description: body.description,
          category: body.category || 'OTHER',
          weightKg: body.weightKg || 1.0,
          dimensions: body.dimensions || { lengthCm: 20, widthCm: 15, heightCm: 10 },
          declaredValue: body.declaredValue || 1000,
          pickupLocation: body.pickupLocation,
          dropoffLocation: body.dropoffLocation,
          earliestPickupTime: body.earliestPickupTime,
          deliveryDeadline: body.deliveryDeadline,
          transportModePreference: body.transportModePreference,
          status: 'MATCHING',
          pickupOtp: ComplianceAndSafetyModule.generateSecureOtp(),
          dropoffOtp: ComplianceAndSafetyModule.generateSecureOtp(),
          pricingQuote: quote,
          createdAt: new Date().toISOString(),
        };

        store.saveShipment(shipment);
        return sendJson(res, 201, { success: true, data: shipment });
      }

      // 8. 時空走廊媒合：為包裹尋找順路旅人
      const matchShipmentMatch = pathname.match(/^\/api\/matching\/shipments\/([^/]+)$/);
      if (matchShipmentMatch && method === 'GET') {
        const shipmentId = matchShipmentMatch[1];
        const shipment = store.getShipment(shipmentId);
        if (!shipment) {
          return sendJson(res, 404, { success: false, message: '找不到指定包裹' });
        }
        const matches = CorridorMatchingEngine.matchItinerariesForShipment(
          shipment,
          store.getAllItineraries()
        );
        return sendJson(res, 200, {
          success: true,
          shipmentId,
          totalMatches: matches.length,
          matches,
        });
      }

      // 9. 時空走廊媒合：為旅人尋找順路包裹
      const matchItinMatch = pathname.match(/^\/api\/matching\/itineraries\/([^/]+)$/);
      if (matchItinMatch && method === 'GET') {
        const itineraryId = matchItinMatch[1];
        const itinerary = store.getItinerary(itineraryId);
        if (!itinerary) {
          return sendJson(res, 404, { success: false, message: '找不到指定行程' });
        }
        const matches = CorridorMatchingEngine.matchShipmentsForItinerary(
          itinerary,
          store.getAllShipments()
        );
        return sendJson(res, 200, {
          success: true,
          itineraryId,
          totalMatches: matches.length,
          matches,
        });
      }

      // 10. 旅人確認接單並鎖定託管資金
      const acceptMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/accept$/);
      if (acceptMatch && method === 'POST') {
        const shipmentId = acceptMatch[1];
        const body = await parseJsonBody(req);
        const shipment = store.getShipment(shipmentId);
        if (!shipment) {
          return sendJson(res, 404, { success: false, message: '找不到包裹' });
        }

        shipment.assignedTravelerId = body.travelerId;
        shipment.assignedItineraryId = body.itineraryId;
        shipment.status = 'ACCEPTED';

        // 鎖定寄件人款項進入 Escrow
        const escrowTx = escrowService.holdEscrowForShipment(shipment);

        return sendJson(res, 200, {
          success: true,
          message: '已成功媒合接單！款項已安全進入平台託管保管。請於面交時執行開箱驗視存證。',
          shipment,
          escrow: escrowTx,
        });
      }

      // 11. 實體開箱驗視與取件 OTP 驗證 (進入運送中)
      const inspectPickupMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/inspect-and-pickup$/);
      if (inspectPickupMatch && method === 'POST') {
        const shipmentId = inspectPickupMatch[1];
        const body = await parseJsonBody(req);
        const shipment = store.getShipment(shipmentId);
        if (!shipment) {
          return sendJson(res, 404, { success: false, message: '找不到包裹' });
        }

        const verifyResult = ComplianceAndSafetyModule.verifyPickupAndInspection({
          shipment,
          travelerId: body.travelerId,
          inputOtp: body.otp,
          checklist: body.checklist,
          photoUrls: body.photoUrls,
        });

        if (!verifyResult.success) {
          return sendJson(res, 400, verifyResult);
        }

        return sendJson(res, 200, {
          success: true,
          message: verifyResult.message,
          shipment,
        });
      }

      // 12. 送達簽收 OTP 驗證與託管資金釋放結算
      const deliverMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/deliver$/);
      if (deliverMatch && method === 'POST') {
        const shipmentId = deliverMatch[1];
        const body = await parseJsonBody(req);
        const shipment = store.getShipment(shipmentId);
        if (!shipment) {
          return sendJson(res, 404, { success: false, message: '找不到包裹' });
        }

        const verifyResult = ComplianceAndSafetyModule.verifyDropoff({
          shipment,
          travelerId: body.travelerId,
          inputOtp: body.otp,
          photoUrls: body.photoUrls,
        });

        if (!verifyResult.success) {
          return sendJson(res, 400, verifyResult);
        }

        // 解鎖資金分帳
        const payout = escrowService.releaseEscrowToTraveler(shipment);

        return sendJson(res, 200, {
          success: true,
          message: verifyResult.message,
          payout,
          shipment,
        });
      }

      // 13. 查看錢包與託管資產
      const walletMatch = pathname.match(/^\/api\/wallets\/([^/]+)$/);
      if (walletMatch && method === 'GET') {
        const userId = walletMatch[1];
        const wallet = escrowService.getOrCreateWallet(userId, '用戶');
        return sendJson(res, 200, { success: true, data: wallet });
      }

      // 預設 404
      return sendJson(res, 404, { success: false, error: 'NOT_FOUND', path: pathname });
    } catch (err: any) {
      console.error('Server error:', err);
      return sendJson(res, 500, { success: false, error: err.message || 'Internal Server Error' });
    }
  });

  return server;
}

// 若直接執行此檔案
if (process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js') || process.env.NODE_ENV === 'production')) {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const HOST = process.env.HOST;
  const server = createServer();
  if (HOST) {
    server.listen(PORT, HOST, () => {
      console.log(`🚀 Multi-Modal Courier Platform API running on http://${HOST}:${PORT}`);
    });
  } else {
    server.listen(PORT, () => {
      console.log(`🚀 Multi-Modal Courier Platform API running on http://localhost:${PORT}`);
    });
  }
}

