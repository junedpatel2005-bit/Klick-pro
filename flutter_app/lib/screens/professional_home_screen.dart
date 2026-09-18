import 'package:flutter/material.dart';
import '../models/job_model.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../services/job_service.dart';
import '../widgets/fade_slide_transition.dart';
import 'login_screen.dart';

class ProfessionalHomeScreen extends StatefulWidget {
  final UserModel user;

  const ProfessionalHomeScreen({super.key, required this.user});

  @override
  State<ProfessionalHomeScreen> createState() => _ProfessionalHomeScreenState();
}

class _ProfessionalHomeScreenState extends State<ProfessionalHomeScreen> {
  final _jobService = JobService();
  final _authService = AuthService();
  final _searchController = TextEditingController();

  List<JobModel> _jobs = [];
  bool _isLoading = true;
  String _selectedCategory = 'All';
  int _selectedTabIndex = 0;
  int _currentBottomNavIndex = 0;
  bool _verifiedOnly = false;

  final List<String> _categories = ['All', 'Residential', 'Commercial', 'Industrial'];
  final List<String> _tabs = ['All jobs', 'Saved (0)', 'My Proposals (0)', 'Hire Requests (0)'];

  @override
  void initState() {
    super.initState();
    _fetchJobs();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchJobs() async {
    setState(() => _isLoading = true);

    final jobs = await _jobService.getMarketplaceJobs(
      searchQuery: _searchController.text,
      categoryFilter: _selectedCategory,
    );

    if (mounted) {
      setState(() {
        _jobs = _verifiedOnly ? jobs.where((j) => j.clientVerified).toList() : jobs;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Log Out'),
        content: const Text('Are you sure you want to log out of your account?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
            ),
            child: const Text('Log Out'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await _authService.logout();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          transitionDuration: const Duration(milliseconds: 400),
          pageBuilder: (_, animation, secondaryAnimation) => FadeTransition(opacity: animation, child: const LoginScreen()),
        ),
      );
    }
  }

  void _showApplyModal(JobModel job) {
    final quoteController = TextEditingController();
    final messageController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          top: 24,
          left: 20,
          right: 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Submit Proposal',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              job.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
            ),
            const SizedBox(height: 16),

            // Budget Highlight Card
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFDBEAFE)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Client Budget Range:', style: TextStyle(fontSize: 12, color: Color(0xFF1E3A8A))),
                  Text(
                    job.formattedBudget,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            TextField(
              controller: quoteController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'Your Bid Amount',
                prefixText: '₹ ',
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),

            TextField(
              controller: messageController,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: 'Cover Note / Introduction',
                hintText: 'Introduce your experience and timeline...',
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 20),

            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Row(
                      children: [
                        const Icon(Icons.check_circle, color: Colors.white, size: 20),
                        const SizedBox(width: 8),
                        Expanded(child: Text('Quote submitted for "${job.title}"!')),
                      ],
                    ),
                    backgroundColor: const Color(0xFF10B981),
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1D4ED8),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Send Proposal Now', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        title: Row(
          children: [
            Hero(
              tag: 'user-avatar',
              child: CircleAvatar(
                radius: 18,
                backgroundColor: const Color(0xFFDBEAFE),
                child: Text(
                  widget.user.firstName.isNotEmpty ? widget.user.firstName[0].toUpperCase() : 'P',
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.user.fullName.isNotEmpty ? widget.user.fullName : 'Professional',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'PRO PORTAL',
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Color(0xFF1D4ED8)),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.blueGrey),
            tooltip: 'Refresh Jobs',
            onPressed: _fetchJobs,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444)),
            tooltip: 'Log Out',
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: _currentBottomNavIndex == 0
          ? RefreshIndicator(
              onRefresh: _fetchJobs,
              color: const Color(0xFF1D4ED8),
              child: CustomScrollView(
                slivers: [
                  // Page Header
                  SliverToBoxAdapter(
                    child: Container(
                      color: Colors.white,
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Find Jobs',
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF0F172A),
                                  letterSpacing: -0.5,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEFF6FF),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: const Color(0xFFDBEAFE)),
                                ),
                                child: const Row(
                                  children: [
                                    Icon(Icons.map_outlined, size: 14, color: Color(0xFF1D4ED8)),
                                    SizedBox(width: 4),
                                    Text(
                                      'Show Map',
                                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${_jobs.length} jobs available across 212 listings',
                            style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                          ),
                          const SizedBox(height: 16),

                          // Animated Tab Row
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: List.generate(_tabs.length, (index) {
                                final isSelected = _selectedTabIndex == index;
                                return GestureDetector(
                                  onTap: () => setState(() => _selectedTabIndex = index),
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 250),
                                    margin: const EdgeInsets.only(right: 8),
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: isSelected ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(20),
                                      boxShadow: isSelected
                                          ? [
                                              BoxShadow(
                                                color: Colors.black.withValues(alpha: 0.12),
                                                blurRadius: 8,
                                                offset: const Offset(0, 2),
                                              ),
                                            ]
                                          : [],
                                    ),
                                    child: Text(
                                      _tabs[index],
                                      style: TextStyle(
                                        color: isSelected ? Colors.white : Colors.grey.shade700,
                                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                );
                              }),
                            ),
                          ),
                          const SizedBox(height: 14),

                          // Modern Search Bar
                          TextField(
                            controller: _searchController,
                            onSubmitted: (_) => _fetchJobs(),
                            decoration: InputDecoration(
                              hintText: "Try 'plumber', 'react developer', 'laser'...",
                              hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
                              prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF1D4ED8)),
                              suffixIcon: _searchController.text.isNotEmpty
                                  ? IconButton(
                                      icon: const Icon(Icons.cancel, size: 18, color: Colors.grey),
                                      onPressed: () {
                                        _searchController.clear();
                                        _fetchJobs();
                                      },
                                    )
                                  : null,
                              filled: true,
                              fillColor: const Color(0xFFF8FAFC),
                              contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(color: Colors.grey.shade200),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(color: Colors.grey.shade200),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),

                          // Categories & Filter row
                          Row(
                            children: [
                              Expanded(
                                child: SingleChildScrollView(
                                  scrollDirection: Axis.horizontal,
                                  child: Row(
                                    children: _categories.map((cat) {
                                      final isSelected = _selectedCategory == cat;
                                      return Padding(
                                        padding: const EdgeInsets.only(right: 8.0),
                                        child: InkWell(
                                          onTap: () {
                                            setState(() => _selectedCategory = cat);
                                            _fetchJobs();
                                          },
                                          borderRadius: BorderRadius.circular(10),
                                          child: AnimatedContainer(
                                            duration: const Duration(milliseconds: 200),
                                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                            decoration: BoxDecoration(
                                              color: isSelected ? const Color(0xFFEFF6FF) : Colors.white,
                                              borderRadius: BorderRadius.circular(10),
                                              border: Border.all(
                                                color: isSelected ? const Color(0xFF2563EB) : Colors.grey.shade200,
                                                width: isSelected ? 1.5 : 1,
                                              ),
                                            ),
                                            child: Text(
                                              cat,
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                                color: isSelected ? const Color(0xFF1D4ED8) : Colors.grey.shade700,
                                              ),
                                            ),
                                          ),
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                ),
                              ),
                              IconButton(
                                icon: Icon(
                                  _verifiedOnly ? Icons.verified_rounded : Icons.verified_outlined,
                                  color: _verifiedOnly ? const Color(0xFF2563EB) : Colors.grey,
                                  size: 22,
                                ),
                                tooltip: 'Verified Clients Only',
                                onPressed: () {
                                  setState(() => _verifiedOnly = !_verifiedOnly);
                                  _fetchJobs();
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Header for list
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.near_me_rounded, size: 18, color: Color(0xFF1D4ED8)),
                              SizedBox(width: 6),
                              Text(
                                'Jobs near you',
                                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                              ),
                            ],
                          ),
                          Text(
                            '${_jobs.length} results',
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Job Cards list with staggered animation
                  _isLoading
                      ? const SliverFillRemaining(
                          child: Center(child: CircularProgressIndicator(color: Color(0xFF1D4ED8))),
                        )
                      : _jobs.isEmpty
                          ? SliverFillRemaining(
                              child: Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.search_off_rounded, size: 48, color: Colors.grey.shade400),
                                    const SizedBox(height: 12),
                                    const Text('No matching jobs found', style: TextStyle(fontWeight: FontWeight.w600)),
                                    const SizedBox(height: 6),
                                    TextButton(
                                      onPressed: () {
                                        _searchController.clear();
                                        setState(() {
                                          _selectedCategory = 'All';
                                          _verifiedOnly = false;
                                        });
                                        _fetchJobs();
                                      },
                                      child: const Text('Clear all filters'),
                                    ),
                                  ],
                                ),
                              ),
                            )
                          : SliverPadding(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              sliver: SliverList(
                                delegate: SliverChildBuilderDelegate(
                                  (context, index) {
                                    final job = _jobs[index];
                                    return FadeSlideAnimation(
                                      delay: Duration(milliseconds: 60 * (index < 5 ? index : 5)),
                                      child: _buildJobCard(job),
                                    );
                                  },
                                  childCount: _jobs.length,
                                ),
                              ),
                            ),
                ],
              ),
            )
          : _buildPlaceholderTab(),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Colors.grey.shade200)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentBottomNavIndex,
          onTap: (index) => setState(() => _currentBottomNavIndex = index),
          selectedItemColor: const Color(0xFF1D4ED8),
          unselectedItemColor: Colors.grey.shade500,
          backgroundColor: Colors.white,
          elevation: 0,
          type: BottomNavigationBarType.fixed,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.work_outline_rounded), activeIcon: Icon(Icons.work_rounded), label: 'Find Jobs'),
            BottomNavigationBarItem(icon: Icon(Icons.assignment_outlined), activeIcon: Icon(Icons.assignment_rounded), label: 'Proposals'),
            BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet_outlined), activeIcon: Icon(Icons.account_balance_wallet_rounded), label: 'Earnings'),
            BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded), activeIcon: Icon(Icons.person_rounded), label: 'Profile'),
          ],
        ),
      ),
    );
  }

  Widget _buildJobCard(JobModel job) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200, width: 1.1),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(18.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    job.category.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1D4ED8),
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFA7F3D0)),
                  ),
                  child: Text(
                    job.status,
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            Text(
              job.title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
                height: 1.3,
              ),
            ),
            const SizedBox(height: 6),

            Row(
              children: [
                Icon(Icons.location_on_outlined, size: 15, color: Colors.grey.shade500),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    job.distanceKm != null
                        ? '${job.formattedLocation} • ${job.distanceKm!.toStringAsFixed(1)} km away'
                        : job.formattedLocation,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (job.clientVerified) ...[
                  const Icon(Icons.verified_rounded, size: 14, color: Color(0xFF2563EB)),
                  const SizedBox(width: 4),
                  Text(
                    job.clientName,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF1E3A8A)),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 10),

            Text(
              job.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 13, color: Colors.grey.shade700, height: 1.4),
            ),
            const SizedBox(height: 14),
            Divider(height: 1, color: Colors.grey.shade100),
            const SizedBox(height: 14),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ESTIMATED BUDGET',
                      style: TextStyle(fontSize: 9, color: Colors.grey.shade500, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      job.formattedBudget,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF1D4ED8)),
                    ),
                  ],
                ),
                ElevatedButton.icon(
                  onPressed: () => _showApplyModal(job),
                  icon: const Icon(Icons.send_rounded, size: 14),
                  label: const Text('Send Quote', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1D4ED8),
                    foregroundColor: Colors.white,
                    elevation: 2,
                    shadowColor: const Color(0xFF1D4ED8).withValues(alpha: 0.4),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholderTab() {
    final titles = ['', 'My Submitted Proposals', 'Earnings & Withdrawals', 'Professional Profile'];
    return Center(
      child: FadeSlideAnimation(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 70,
              height: 70,
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.work_outline_rounded, size: 34, color: Color(0xFF1D4ED8)),
            ),
            const SizedBox(height: 16),
            Text(
              titles[_currentBottomNavIndex],
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 6),
            Text(
              'Connected to Klick-Pro database for ${widget.user.fullName}',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
