class JobModel {
  final int id;
  final String title;
  final String description;
  final String category;
  final String? locationLabel;
  final String? locationState;
  final String? locationDistrict;
  final int? budgetMin;
  final int? budgetMax;
  final int? hourlyRate;
  final String timingType;
  final String clientName;
  final bool clientVerified;
  final String status;
  final DateTime createdAt;
  final int proposalCount;
  final double? distanceKm;

  JobModel({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    this.locationLabel,
    this.locationState,
    this.locationDistrict,
    this.budgetMin,
    this.budgetMax,
    this.hourlyRate,
    this.timingType = 'FIXED',
    this.clientName = 'Client',
    this.clientVerified = false,
    this.status = 'OPEN',
    required this.createdAt,
    this.proposalCount = 0,
    this.distanceKm,
  });

  String get formattedBudget {
    if (timingType == 'HOURLY' && hourlyRate != null) {
      return '₹$hourlyRate/hr';
    }
    if (budgetMin != null && budgetMax != null) {
      return '₹$budgetMin - ₹$budgetMax';
    }
    if (budgetMin != null) {
      return 'From ₹$budgetMin';
    }
    if (budgetMax != null) {
      return 'Up to ₹$budgetMax';
    }
    return 'Negotiable';
  }

  String get formattedLocation {
    final parts = [locationDistrict, locationState]
        .where((p) => p != null && p.trim().isNotEmpty)
        .toList();
    if (parts.isNotEmpty) return parts.join(', ');
    return locationLabel ?? 'India';
  }

  factory JobModel.fromJson(Map<String, dynamic> json) {
    return JobModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      title: json['title'] ?? 'Untitled Job',
      description: json['description'] ?? '',
      category: json['category'] ?? 'General',
      locationLabel: json['locationLabel'],
      locationState: json['locationState'],
      locationDistrict: json['locationDistrict'],
      budgetMin: json['budgetMin'],
      budgetMax: json['budgetMax'],
      hourlyRate: json['hourlyRate'],
      timingType: json['timingType'] ?? 'FIXED',
      clientName: json['clientName'] ?? 'Client',
      clientVerified: json['clientVerified'] == true,
      status: json['status'] ?? 'OPEN',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt']) ?? DateTime.now()
          : DateTime.now(),
      proposalCount: json['proposalCount'] ?? 0,
      distanceKm: json['distanceKm'] != null ? (json['distanceKm'] as num).toDouble() : null,
    );
  }
}

