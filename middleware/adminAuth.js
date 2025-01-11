const adminAuth = async (req, res, next) => {
    try {
        // Check if user is authenticated and is an admin
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(403).json({ error: 'Admin access required' });
    }
};

export default adminAuth;
