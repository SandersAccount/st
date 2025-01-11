const Collection = require('../models/Collection');
const Image = require('../models/Image');
const Tag = require('../models/Tag');

class AnalyticsService {
    async getUserStats(userId) {
        try {
            const [
                collections,
                sharedCollections,
                images,
                tags
            ] = await Promise.all([
                Collection.countDocuments({ owner: userId }),
                Collection.countDocuments({ 'collaborators.userId': userId }),
                Image.countDocuments({ createdBy: userId }),
                Tag.countDocuments({ createdBy: userId })
            ]);

            return {
                collections,
                sharedCollections,
                images,
                tags,
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            throw error;
        }
    }

    async getCollectionStats(collectionId) {
        try {
            const collection = await Collection.findById(collectionId)
                .populate('images')
                .populate('collaborators.userId', 'username email');

            if (!collection) {
                throw new Error('Collection not found');
            }

            // Get image stats
            const imageStats = {
                total: collection.images.length,
                byCategory: {},
                byTag: {},
                topTags: [],
                sizeTotal: 0,
                averageSize: 0
            };

            // Process images
            collection.images.forEach(image => {
                // Category stats
                imageStats.byCategory[image.category] = 
                    (imageStats.byCategory[image.category] || 0) + 1;

                // Tag stats
                image.tags.forEach(tag => {
                    imageStats.byTag[tag] = 
                        (imageStats.byTag[tag] || 0) + 1;
                });

                // Size stats
                if (image.metadata?.size) {
                    imageStats.sizeTotal += image.metadata.size;
                }
            });

            // Calculate average size
            imageStats.averageSize = imageStats.total ? 
                Math.round(imageStats.sizeTotal / imageStats.total) : 0;

            // Get top tags
            imageStats.topTags = Object.entries(imageStats.byTag)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([tag, count]) => ({ tag, count }));

            // Get collaboration stats
            const collaborationStats = {
                totalCollaborators: collection.collaborators.length,
                byRole: collection.collaborators.reduce((acc, curr) => {
                    acc[curr.role] = (acc[curr.role] || 0) + 1;
                    return acc;
                }, {})
            };

            return {
                imageStats,
                collaborationStats,
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('Error getting collection stats:', error);
            throw error;
        }
    }

    async getTagUsageStats() {
        try {
            const tags = await Tag.find().sort('-usageCount').limit(20);
            
            return {
                topTags: tags.map(tag => ({
                    id: tag._id,
                    name: tag.name,
                    usageCount: tag.usageCount,
                    color: tag.color
                })),
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('Error getting tag usage stats:', error);
            throw error;
        }
    }

    async trackImageView(imageId, userId) {
        try {
            await Image.findByIdAndUpdate(imageId, {
                $inc: { viewCount: 1 },
                $push: {
                    viewHistory: {
                        userId,
                        viewedAt: new Date()
                    }
                }
            });
        } catch (error) {
            console.error('Error tracking image view:', error);
        }
    }

    async getActivityTimeline(userId, days = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const [collections, images, tags] = await Promise.all([
                Collection.find({
                    owner: userId,
                    createdAt: { $gte: startDate }
                }).select('createdAt'),
                Image.find({
                    createdBy: userId,
                    createdAt: { $gte: startDate }
                }).select('createdAt'),
                Tag.find({
                    createdBy: userId,
                    createdAt: { $gte: startDate }
                }).select('createdAt')
            ]);

            // Group activities by date
            const timeline = {};
            const addToTimeline = (date, type) => {
                const dateStr = date.toISOString().split('T')[0];
                timeline[dateStr] = timeline[dateStr] || { collections: 0, images: 0, tags: 0 };
                timeline[dateStr][type]++;
            };

            collections.forEach(c => addToTimeline(c.createdAt, 'collections'));
            images.forEach(i => addToTimeline(i.createdAt, 'images'));
            tags.forEach(t => addToTimeline(t.createdAt, 'tags'));

            return {
                timeline: Object.entries(timeline).map(([date, stats]) => ({
                    date,
                    ...stats
                })),
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('Error getting activity timeline:', error);
            throw error;
        }
    }
}

module.exports = new AnalyticsService();
