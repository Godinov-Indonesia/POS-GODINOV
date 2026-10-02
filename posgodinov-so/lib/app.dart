import 'package:flutter/material.dart';
import 'core/di/injection.dart';
import 'core/storage/token_storage.dart';
import 'core/theme/app_theme.dart';
import 'features/device_binding/device_binding_screen.dart';
import 'features/opname_session/session_list_screen.dart';
import 'features/staff_auth/staff_select_screen.dart';

class PosGodinovSoApp extends StatelessWidget {
  const PosGodinovSoApp({super.key});

  Future<Widget> _resolveInitialScreen() async {
    final tokenStorage = getIt<TokenStorage>();
    final token = await tokenStorage.getDeviceToken();
    if (token == null || token.isEmpty) {
      return const DeviceBindingScreen();
    }

    final staffId = await tokenStorage.getActiveStaffId();
    if (staffId == null || staffId.isEmpty) {
      return const StaffSelectScreen();
    }

    return const SessionListScreen();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Godinov SO',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: FutureBuilder<Widget>(
        future: _resolveInitialScreen(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Scaffold(
              body: Center(
                child: CircularProgressIndicator(),
              ),
            );
          }
          return snapshot.data ?? const DeviceBindingScreen();
        },
      ),
    );
  }
}
