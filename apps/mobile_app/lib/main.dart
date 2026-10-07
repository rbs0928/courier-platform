import 'package:flutter/material.dart';
import 'screens/sender_screen.dart';
import 'screens/traveler_screen.dart';

void main() {
  runApp(const CourierPlatformApp());
}

class CourierPlatformApp extends StatelessWidget {
  const CourierPlatformApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '順路捎帶快遞平台',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.blue,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.blue,
        brightness: Brightness.dark,
      ),
      home: const MainNavigationShell(),
    );
  }
}

class MainNavigationShell extends StatefulWidget {
  const MainNavigationShell({super.key});

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    SenderScreen(),
    TravelerScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.local_shipping_outlined),
            selectedIcon: Icon(Icons.local_shipping),
            label: '我要寄件',
          ),
          NavigationDestination(
            icon: Icon(Icons.two_wheeler_outlined),
            selectedIcon: Icon(Icons.two_wheeler),
            label: '順路接單',
          ),
        ],
      ),
    );
  }
}
