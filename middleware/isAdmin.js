// Middleware to check if user is an admin
export default async function isAdmin(req, res, next) {
    try {
        // Check if user exists and is admin
        if (!req.user || !req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }
        next();
    } catch (error) {
        console.error('Error in isAdmin middleware:', error);
        res.status(500).json({ error: 'Server error' });
    }
}
