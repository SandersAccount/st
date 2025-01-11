import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    try {
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            retryWrites: true,
            w: 'majority',
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            family: 4 // Use IPv4, skip trying IPv6
        };

        await mongoose.connect(process.env.MONGODB_URI, options);
        console.log('Connected to MongoDB successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        // Don't exit in development, but you might want to in production
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
};

// Handle connection events
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB');
});

// If Node process ends, close the Mongoose connection
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('Mongoose connection closed through app termination');
        process.exit(0);
    } catch (err) {
        console.error('Error closing Mongoose connection:', err);
        process.exit(1);
    }
});

connectDB();

export default mongoose;
