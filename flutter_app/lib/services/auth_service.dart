import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import '../models/user_model.dart';

class AuthResult {
  final bool success;
  final String? message;
  final UserModel? user;
  final String? token;

  AuthResult({
    required this.success,
    this.message,
    this.user,
    this.token,
  });
}

class AuthService {
  static const String _keyToken = 'auth_token';
  static const String _keyUser = 'auth_user';

  /// Sign in with email and password via Next.js backend API
  Future<AuthResult> login(String email, String password) async {
    try {
      final baseUrl = await ApiConfig.getBaseUrl();
      final url = Uri.parse('$baseUrl/api/auth/login');

      final response = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'email': email.trim(),
              'password': password,
            }),
          )
          .timeout(const Duration(seconds: 15));

      final data = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode == 200 && data['success'] == true) {
        String? token = data['token'];

        // Fallback: extract token from Set-Cookie header if not in body
        if (token == null || token.isEmpty) {
          final setCookie = response.headers['set-cookie'];
          if (setCookie != null) {
            final match = RegExp(r'servio_session=([^;]+)').firstMatch(setCookie);
            if (match != null) {
              token = match.group(1);
            }
          }
        }

        UserModel? user;
        if (data['user'] != null) {
          user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
        }

        // Save session locally
        final prefs = await SharedPreferences.getInstance();
        if (token != null) {
          await prefs.setString(_keyToken, token);
        }
        if (user != null) {
          await prefs.setString(_keyUser, jsonEncode(user.toJson()));
        }

        return AuthResult(
          success: true,
          token: token,
          user: user,
          message: 'Login successful',
        );
      } else {
        final errorMessage = data['error'] ?? data['message'] ?? 'Login failed (${response.statusCode})';
        return AuthResult(
          success: false,
          message: errorMessage.toString(),
        );
      }
    } catch (e) {
      return AuthResult(
        success: false,
        message: 'Connection error: Could not reach server. Check your network or server URL.\n($e)',
      );
    }
  }

  /// Get currently stored auth token
  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyToken);
  }

  /// Get cached user from local storage
  Future<UserModel?> getCachedUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString(_keyUser);
    if (userJson != null) {
      try {
        return UserModel.fromJson(jsonDecode(userJson));
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  /// Fetch user profile from `/api/auth/me`
  Future<UserModel?> fetchCurrentUser() async {
    try {
      final token = await getToken();
      if (token == null) return null;

      final baseUrl = await ApiConfig.getBaseUrl();
      final url = Uri.parse('$baseUrl/api/auth/me');

      final response = await http.get(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
          'Cookie': 'servio_session=$token',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['user'] != null) {
          final user = UserModel.fromJson(data['user']);
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_keyUser, jsonEncode(user.toJson()));
          return user;
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Log out and clear stored session
  Future<void> logout() async {
    try {
      final token = await getToken();
      final baseUrl = await ApiConfig.getBaseUrl();
      final url = Uri.parse('$baseUrl/api/auth/logout');

      if (token != null) {
        await http.post(
          url,
          headers: {
            'Authorization': 'Bearer $token',
            'Cookie': 'servio_session=$token',
          },
        ).timeout(const Duration(seconds: 5));
      }
    } catch (_) {
      // Ignore network errors on logout
    } finally {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_keyToken);
      await prefs.remove(_keyUser);
    }
  }
}

