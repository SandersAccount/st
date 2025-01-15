import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://bauer5326278:wp5dYnhSWTg5t6SF@cluster0.wd1ds.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testConnection() {
    try {
        const options = {
            retryWrites: true,
            w: 'majority',
            serverSelectionTimeoutMS: 5000,
            family: 4,
            tls: true
        };

        console.log('Attempting to connect to MongoDB...');
        await mongoose.connect(MONGODB_URI, options);
        console.log('Successfully connected to MongoDB!');
        
        // Try to list collections to verify full access
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('\nAvailable collections:');
        collections.forEach(collection => {
            console.log(`- ${collection.name}`);
        });

    } catch (error) {
        console.error('Connection error:', error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

testConnection();
