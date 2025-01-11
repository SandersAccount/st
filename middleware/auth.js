import jwt from 'jsonwebtoken';
import User from '../models/user.js';

const auth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        
        if (!token) {
            throw new Error('No token provided');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (!decoded || !decoded.userId) {
            throw new Error('Invalid token');
        }

        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            throw new Error('User not found');
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        res.status(401).json({ error: 'Please authenticate' });
    }
};

export default auth;
