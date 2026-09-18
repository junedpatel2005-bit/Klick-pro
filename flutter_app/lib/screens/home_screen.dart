import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';
import 'client_home_screen.dart';
import 'login_screen.dart';
import 'professional_home_screen.dart';

class HomeScreen extends StatefulWidget {
  final UserModel? user;

  const HomeScreen({super.key, this.user});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _authService = AuthService();
  UserModel? _currentUser;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _currentUser = widget.user;
    if (_currentUser == null) {
      _loadUser();
    } else {
      _isLoading = false;
    }
  }

  Future<void> _loadUser() async {
    final cached = await _authService.getCachedUser();
    if (cached != null && mounted) {
      setState(() {
        _currentUser = cached;
        _isLoading = false;
      });
      return;
    }

    final fresh = await _authService.fetchCurrentUser();
    if (mounted) {
      setState(() {
        _currentUser = fresh;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final user = _currentUser;

    if (user == null) {
      return const LoginScreen();
    }

    // Role-based Home Routing (same as Klick-Pro web app):
    // If user is PROFESSIONAL -> ProfessionalHomeScreen (Find Jobs)
    // If user is CLIENT -> ClientHomeScreen (Client Dashboard / Post Job)
    if (user.role.toUpperCase() == 'PROFESSIONAL') {
      return ProfessionalHomeScreen(user: user);
    } else {
      return ClientHomeScreen(user: user);
    }
  }
}
