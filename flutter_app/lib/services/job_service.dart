import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/job_model.dart';
import 'auth_service.dart';

class JobService {
  final _authService = AuthService();

  /// Fetch public jobs for Professionals (from /api/marketplace/jobs)
  Future<List<JobModel>> getMarketplaceJobs({
    String? searchQuery,
    String? categoryFilter,
  }) async {
    try {
      final baseUrl = await ApiConfig.getBaseUrl();
      final url = Uri.parse('$baseUrl/api/marketplace/jobs');

      final response = await http.get(
        url,
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        var jobs = data.map((item) => JobModel.fromJson(item as Map<String, dynamic>)).toList();

        // Apply in-app search & category filtering
        if (searchQuery != null && searchQuery.trim().isNotEmpty) {
          final query = searchQuery.toLowerCase().trim();
          jobs = jobs.where((j) =>
              j.title.toLowerCase().contains(query) ||
              j.description.toLowerCase().contains(query) ||
              j.category.toLowerCase().contains(query)).toList();
        }

        if (categoryFilter != null && categoryFilter.isNotEmpty && categoryFilter != 'All') {
          jobs = jobs.where((j) =>
              j.category.toLowerCase().contains(categoryFilter.toLowerCase())).toList();
        }

        if (jobs.isNotEmpty) {
          return jobs;
        }
      }
    } catch (_) {
      // Return sample jobs if server is offline or during testing
    }

    return _getSampleMarketplaceJobs(
      searchQuery: searchQuery,
      categoryFilter: categoryFilter,
    );
  }

  /// Fetch jobs created by the authenticated Client (from /api/client/jobs)
  Future<List<JobModel>> getClientJobs() async {
    try {
      final token = await _authService.getToken();
      if (token == null) return _getSampleClientJobs();

      final baseUrl = await ApiConfig.getBaseUrl();
      final url = Uri.parse('$baseUrl/api/client/jobs');

      final response = await http.get(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
          'Cookie': 'servio_session=$token',
        },
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List<dynamic> list = data['jobs'] ?? [];
        if (list.isNotEmpty) {
          return list.map((item) => JobModel.fromJson(item)).toList();
        }
      }
    } catch (_) {
      // Fall through to sample jobs on offline/error
    }

    return _getSampleClientJobs();
  }

  /// Create a new Job as a Client
  Future<bool> postJob({
    required String title,
    required String category,
    required String description,
    required int budgetMax,
    required String locationLabel,
  }) async {
    try {
      final token = await _authService.getToken();
      final baseUrl = await ApiConfig.getBaseUrl();
      final url = Uri.parse('$baseUrl/api/client/jobs');

      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
          if (token != null) 'Cookie': 'servio_session=$token',
        },
        body: jsonEncode({
          'title': title,
          'category': category,
          'description': description,
          'budgetMax': budgetMax,
          'locationLabel': locationLabel,
          'mode': 'publish',
        }),
      ).timeout(const Duration(seconds: 10));

      return response.statusCode == 200 || response.statusCode == 201;
    } catch (_) {
      return false;
    }
  }

  List<JobModel> _getSampleMarketplaceJobs({String? searchQuery, String? categoryFilter}) {
    final samples = [
      JobModel(
        id: 101,
        title: 'Urgent: Industrial civil work Needed in Mumbai',
        description: 'Immediate hiring for industrial civil work (Civil & Infrastructure). Require certified civil work contractors.',
        category: 'INDUSTRIAL CIVIL WORK',
        locationLabel: 'Maharashtra 400001, India',
        locationDistrict: 'Mumbai',
        locationState: 'Maharashtra',
        budgetMin: 45000,
        budgetMax: 95000,
        clientName: 'Client Zub',
        clientVerified: true,
        status: 'OPEN',
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
        distanceKm: 41.6,
      ),
      JobModel(
        id: 102,
        title: 'Urgent: Laser cutting Needed in Bengaluru',
        description: 'Immediate hiring for Laser cutting (Welding & Fabrication). High precision laser cutting sheet metal.',
        category: 'LASER CUTTING',
        locationLabel: 'Karnataka 560001, India',
        locationDistrict: 'Bengaluru',
        locationState: 'Karnataka',
        budgetMin: 20000,
        budgetMax: 40000,
        clientName: 'Rahul M.',
        clientVerified: true,
        status: 'OPEN',
        createdAt: DateTime.now().subtract(const Duration(days: 4)),
        distanceKm: 941.6,
      ),
      JobModel(
        id: 103,
        title: 'Commercial HVAC Ducting & Maintenance in Pune',
        description: 'Complete inspection and duct maintenance for 3-floor office building.',
        category: 'COMMERCIAL',
        locationLabel: 'Maharashtra 411001, India',
        locationDistrict: 'Pune',
        locationState: 'Maharashtra',
        budgetMin: 15000,
        budgetMax: 30000,
        clientName: 'Apex Commercial',
        clientVerified: false,
        status: 'OPEN',
        createdAt: DateTime.now().subtract(const Duration(days: 5)),
        distanceKm: 120.4,
      ),
      JobModel(
        id: 104,
        title: 'Residential Interior Electrical Wiring',
        description: 'Wiring and switchboard setup for modern 3BHK flat.',
        category: 'RESIDENTIAL',
        locationLabel: 'Delhi 110001, India',
        locationDistrict: 'New Delhi',
        locationState: 'Delhi',
        budgetMin: 12000,
        budgetMax: 22000,
        clientName: 'Vikram Sharma',
        clientVerified: true,
        status: 'OPEN',
        createdAt: DateTime.now().subtract(const Duration(days: 6)),
        distanceKm: 1350.0,
      ),
    ];

    var result = samples;
    if (searchQuery != null && searchQuery.trim().isNotEmpty) {
      final q = searchQuery.toLowerCase().trim();
      result = result.where((j) =>
          j.title.toLowerCase().contains(q) ||
          j.category.toLowerCase().contains(q)).toList();
    }
    if (categoryFilter != null && categoryFilter.isNotEmpty && categoryFilter != 'All') {
      result = result.where((j) =>
          j.category.toLowerCase().contains(categoryFilter.toLowerCase())).toList();
    }
    return result;
  }

  List<JobModel> _getSampleClientJobs() {
    return [
      JobModel(
        id: 201,
        title: 'Office Network Cabling & Server Setup',
        description: 'CAT6 cabling across 25 workstations with router & switch configuration.',
        category: 'Commercial IT',
        locationDistrict: 'Mumbai',
        locationState: 'Maharashtra',
        budgetMin: 25000,
        budgetMax: 50000,
        status: 'OPEN',
        proposalCount: 4,
        createdAt: DateTime.now().subtract(const Duration(days: 3)),
      ),
      JobModel(
        id: 202,
        title: 'Plumbing Repairs & Fixture Replacements',
        description: 'Bathroom fittings and kitchen pipe repair.',
        category: 'Residential',
        locationDistrict: 'Thane',
        locationState: 'Maharashtra',
        budgetMin: 5000,
        budgetMax: 10000,
        status: 'RUNNING',
        proposalCount: 6,
        createdAt: DateTime.now().subtract(const Duration(days: 10)),
      ),
    ];
  }
}

