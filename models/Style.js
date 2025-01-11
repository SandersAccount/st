import mongoose from 'mongoose';

const styleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    prompt: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    order: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Initialize orders for existing styles
styleSchema.statics.initializeOrders = async function() {
    const styles = await this.find({ order: { $exists: false } });
    const updatePromises = styles.map((style, index) => {
        style.order = index;
        return style.save();
    });
    await Promise.all(updatePromises);
};

const Style = mongoose.model('Style', styleSchema);

// Initialize orders when the model is first loaded
Style.initializeOrders().catch(console.error);

export default Style;
