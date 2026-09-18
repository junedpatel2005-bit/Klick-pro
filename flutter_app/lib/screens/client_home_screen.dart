import 'package:flutter/material.dart';
import '../models/job_model.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../services/job_service.dart';
import '../widgets/fade_slide_transition.dart';
import 'login_screen.dart';

class ClientHomeScreen extends StatefulWidget {
  final UserModel user;

  const ClientHomeScreen({super.key, required this.user});

  @override
  State<ClientHomeScreen> createState() => _ClientHomeScreenState();
}

class _ClientHomeScreenState extends State<ClientHomeScreen> {
  final _jobService = JobService();
  final _authService = AuthService();

  List<JobModel> _clientJobs = [];
  bool _isLoading = true;
  int _currentBottomNavIndex = 0;

  @override
  void initState() {
    super.initState();
    _fetchClientJobs();
  }

  Future<void> _fetchClientJobs() async {
    setState(() => _isLoading = true);
    final jobs = await _jobService.getClientJobs();
    if (mounted) {
      setState(() {
        _clientJobs = jobs;
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
        content: const Text('Are you sure you want to log out of your client account?'),
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

  void _showPostJobModal() {
    final titleCtrl = TextEditingController();
    final categoryCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final budgetCtrl = TextEditingController();
    final locationCtrl = TextEditingController(text: 'Mumbai, Maharashtra');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (modalContext) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(modalContext).viewInsets.bottom + 20,
          top: 24,
          left: 20,
          right: 20,
        ),
        child: SingleChildScrollView(
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
              const Text(
                'Post a New Project',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 4),
              Text(
                'Describe the requirements and get quotes from verified experts',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
              ),
              const SizedBox(height: 20),

              TextField(
                controller: titleCtrl,
                decoration: InputDecoration(
                  labelText: 'Project Title *',
                  hintText: 'e.g. Electrical wiring for 3BHK flat',
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),

              TextField(
                controller: categoryCtrl,
                decoration: InputDecoration(
                  labelText: 'Category *',
                  hintText: 'e.g. Civil, Laser Cutting, Plumbing',
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),

              TextField(
                controller: budgetCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Estimated Budget *',
                  prefixText: '₹ ',
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),

              TextField(
                controller: locationCtrl,
                decoration: InputDecoration(
                  labelText: 'Location / City',
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),

              TextField(
                controller: descCtrl,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Detailed Description',
                  hintText: 'Explain the work required, timeline, and material specs...',
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 24),

              ElevatedButton(
                onPressed: () async {
                  if (titleCtrl.text.trim().isEmpty) return;
                  final messenger = ScaffoldMessenger.of(context);
                  Navigator.pop(modalContext);

                  final success = await _jobService.postJob(
                    title: titleCtrl.text.trim(),
                    category: categoryCtrl.text.trim().isNotEmpty ? categoryCtrl.text.trim() : 'General',
                    description: descCtrl.text.trim(),
                    budgetMax: int.tryParse(budgetCtrl.text.trim()) ?? 10000,
                    locationLabel: locationCtrl.text.trim(),
                  );

                  if (mounted) {
                    messenger.showSnackBar(
                      SnackBar(
                        content: Row(
                          children: [
                            Icon(success ? Icons.check_circle : Icons.info, color: Colors.white, size: 20),
                            const SizedBox(width: 10),
                            Expanded(child: Text(success ? 'Job published to database!' : 'Job created.')),
                          ],
                        ),
                        backgroundColor: success ? const Color(0xFF10B981) : Colors.orange,
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    );
                    _fetchClientJobs();
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD97706),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Publish Job to Marketplace', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
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
            CircleAvatar(
              radius: 18,
              backgroundColor: const Color(0xFFFEF3C7),
              child: Text(
                widget.user.firstName.isNotEmpty ? widget.user.firstName[0].toUpperCase() : 'C',
                style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF92400E)),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.user.fullName.isNotEmpty ? widget.user.fullName : 'Client',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'CLIENT PORTAL',
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Color(0xFFB45309)),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.blueGrey),
            tooltip: 'Refresh',
            onPressed: _fetchClientJobs,
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
              onRefresh: _fetchClientJobs,
              color: const Color(0xFFD97706),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Post a Job Banner Card with Gradient
                    FadeSlideAnimation(
                      delay: const Duration(milliseconds: 100),
                      child: Container(
                        padding: const EdgeInsets.all(22),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF0F172A).withValues(alpha: 0.15),
                              blurRadius: 18,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'Need a Professional?',
                                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: Colors.amber.shade400.withValues(alpha: 0.2),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: Colors.amber.shade400.withValues(alpha: 0.4)),
                                  ),
                                  child: Text(
                                    'FAST QUOTES',
                                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.amber.shade300),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Post your project and receive competitive quotes from verified contractors.',
                              style: TextStyle(fontSize: 12, color: Colors.white70, height: 1.4),
                            ),
                            const SizedBox(height: 18),
                            ElevatedButton.icon(
                              onPressed: _showPostJobModal,
                              icon: const Icon(Icons.add_circle_outline_rounded, size: 18),
                              label: const Text('Post a Project', style: TextStyle(fontWeight: FontWeight.bold)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFF59E0B),
                                foregroundColor: const Color(0xFF0F172A),
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Quick Stats Row with FadeSlide
                    FadeSlideAnimation(
                      delay: const Duration(milliseconds: 200),
                      child: Row(
                        children: [
                          _buildStatCard('Jobs Posted', '${_clientJobs.length}', Icons.work_outline_rounded, const Color(0xFF2563EB)),
                          const SizedBox(width: 12),
                          _buildStatCard(
                            'Proposals',
                            '${_clientJobs.fold(0, (acc, j) => acc + j.proposalCount)}',
                            Icons.mail_outline_rounded,
                            const Color(0xFF10B981),
                          ),
                          const SizedBox(width: 12),
                          _buildStatCard(
                            'Active',
                            '${_clientJobs.where((j) => j.status == 'RUNNING').length}',
                            Icons.sync_rounded,
                            const Color(0xFFF59E0B),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Section: My Posted Jobs
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'My Posted Jobs',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        ),
                        TextButton.icon(
                          onPressed: _showPostJobModal,
                          icon: const Icon(Icons.add_rounded, size: 18, color: Color(0xFFD97706)),
                          label: const Text('New Job', style: TextStyle(color: Color(0xFFD97706), fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    // Client Jobs List
                    _isLoading
                        ? const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator(color: Color(0xFFD97706))))
                        : _clientJobs.isEmpty
                            ? Center(
                                child: Padding(
                                  padding: const EdgeInsets.all(32.0),
                                  child: Column(
                                    children: [
                                      Icon(Icons.assignment_late_outlined, size: 48, color: Colors.grey.shade400),
                                      const SizedBox(height: 12),
                                      const Text('No jobs posted yet', style: TextStyle(fontWeight: FontWeight.w600)),
                                      const SizedBox(height: 8),
                                      ElevatedButton(
                                        onPressed: _showPostJobModal,
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFFD97706),
                                          foregroundColor: Colors.white,
                                        ),
                                        child: const Text('Post Your First Job'),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                            : Column(
                                children: List.generate(_clientJobs.length, (index) {
                                  return FadeSlideAnimation(
                                    delay: Duration(milliseconds: 80 * index),
                                    child: _buildClientJobCard(_clientJobs[index]),
                                  );
                                }),
                              ),
                  ],
                ),
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
          onTap: (index) {
            if (index == 1) {
              _showPostJobModal();
            } else {
              setState(() => _currentBottomNavIndex = index);
            }
          },
          selectedItemColor: const Color(0xFFD97706),
          unselectedItemColor: Colors.grey.shade500,
          backgroundColor: Colors.white,
          elevation: 0,
          type: BottomNavigationBarType.fixed,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard_rounded), label: 'Dashboard'),
            BottomNavigationBarItem(icon: Icon(Icons.add_box_outlined), activeIcon: Icon(Icons.add_box_rounded), label: 'Post Job'),
            BottomNavigationBarItem(icon: Icon(Icons.chat_bubble_outline_rounded), activeIcon: Icon(Icons.chat_bubble_rounded), label: 'Messages'),
            BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded), activeIcon: Icon(Icons.person_rounded), label: 'Profile'),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F172A).withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(height: 10),
            Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }

  Widget _buildClientJobCard(JobModel job) {
    final isOpen = job.status == 'OPEN';
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    job.category.toUpperCase(),
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                  decoration: BoxDecoration(
                    color: isOpen ? const Color(0xFFECFDF5) : const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isOpen ? const Color(0xFFA7F3D0) : const Color(0xFFBFDBFE)),
                  ),
                  child: Text(
                    job.status,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: isOpen ? const Color(0xFF059669) : const Color(0xFF1D4ED8),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              job.title,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 6),
            Text(
              job.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600, height: 1.4),
            ),
            const SizedBox(height: 12),
            Divider(height: 1, color: Colors.grey.shade100),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  job.formattedBudget,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.people_alt_rounded, size: 14, color: Color(0xFF1D4ED8)),
                      const SizedBox(width: 4),
                      Text(
                        '${job.proposalCount} proposals',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                      ),
                    ],
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
    final titles = ['', 'Post Job', 'Messages & Inbox', 'Client Profile'];
    return Center(
      child: FadeSlideAnimation(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 70,
              height: 70,
              decoration: const BoxDecoration(
                color: Color(0xFFFEF3C7),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.business_center_rounded, size: 34, color: Color(0xFFD97706)),
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
