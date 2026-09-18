import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  static const String _keyCustomBaseUrl = 'custom_base_url';

  /// Default API URL based on platform:
  /// - Android Emulator: 10.0.2.2 maps to PC's localhost
  /// - iOS Simulator / Desktop / Web: localhost
  /// - Real Physical Android phone: Replace with your computer's local Wi-Fi IP (e.g. 192.168.1.5)
  static String get defaultBaseUrl {
    if (kIsWeb) {
      return 'http://localhost:3000';
    }
    if (Platform.isAndroid) {
      // 10.0.2.2 is the special alias to host loopback interface (localhost) in Android emulator
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  /// Get active base URL (user configured or default)
  static Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyCustomBaseUrl) ?? defaultBaseUrl;
  }

  /// Save custom base URL (useful when testing with physical Android phone)
  static Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyCustomBaseUrl, url.trim().replaceAll(RegExp(r'/$'), ''));
  }

  /// Reset to default
  static Future<void> resetBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyCustomBaseUrl);
  }
}

