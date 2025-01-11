import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    try {
        const options = {
            serverSelectionTimeoutMS: 60000,
            socketTimeoutMS: 45000,
            maxPoolSize: 50,
            minPoolSize: 0,
            family: 4
        };

        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        console.log('Attempting to connect to MongoDB...');
        await mongoose.connect(uri, options);
        console.log('Connected to MongoDB successfully');

        // Test the connection
        const adminDb = mongoose.connection.db.admin();
        await adminDb.ping();
        console.log('MongoDB ping successful');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        
        if (process.env.NODE_ENV === 'production') {
            console.log('Retrying connection in 5 seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            try {
                const retryOptions = {
                    ...options,
                    serverSelectionTimeoutMS: 90000,
                    socketTimeoutMS: 75000
                };
                await mongoose.connect(process.env.MONGODB_URI, retryOptions);
                console.log('Connected to MongoDB successfully on retry');
            } catch (retryError) {
                console.error('MongoDB retry connection failed:', retryError);
                process.exit(1);
            }
        }
    }
};

mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB');
});

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

// Connect to MongoDB
connectDB();

export { connectDB, mongoose as default };
