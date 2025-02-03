const config = {
  replicateApiKey: process.env.REPLICATE_API_KEY || 'YOUR_REPLICATE_API_KEY',
  adapter: process.env.ADAPTER || 'replicate' // allows choosing between multiple adapters in future
};

export default config;
