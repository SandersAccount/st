import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    logoUrl: {
        type: String,
        default: null
    },
    appName: {
        type: String,
        default: 'Sticker Generator'
    },
    mainTitle: {
        type: String,
        default: 'AI Image Generator'
    },
    useLogoInstead: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
