import config from '../config/index.js';
import ReplicateAdapter from '../api-adapters/replicateAdapter.js';

class ImageService {
  constructor() {
    // Initialize the adapter based on configuration
    if (config.adapter === 'replicate') {
      this.adapter = new ReplicateAdapter(config);
    } else {
      throw new Error('Unsupported API adapter specified in config');
    }
  }

  async generateImage(prompt) {
    // Delegate image generation to the adapter
    return await this.adapter.generateImage(prompt);
  }
}

export default new ImageService();
