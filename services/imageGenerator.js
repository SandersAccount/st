import Replicate from 'replicate';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class ImageGeneratorService {
    constructor() {
        const token = process.env.REPLICATE_API_TOKEN;
        if (!token) {
            throw new Error('REPLICATE_API_TOKEN is not set in environment variables');
        }

        this.replicate = new Replicate({
            auth: token,
        });
        
        // Model details
        this.MODEL_OWNER = "fofr";
        this.MODEL_NAME = "sticker-maker";
        this.MODEL_VERSION = "4acb778eb059772225ec213948f0660867b2e03f277448f18cf1800b96a65a1a";
        this.MODEL_ID = `${this.MODEL_OWNER}/${this.MODEL_NAME}:${this.MODEL_VERSION}`;
        
        this.DEFAULT_CONFIG = {
            steps: 17,
            width: 1152,
            height: 1152,
            output_format: "png",
            output_quality: 100,
            negative_prompt: "",
            number_of_images: 1
        };
    }

    async testConnection() {
        try {
            console.log('Testing Replicate API connection...');
            console.log('Using API token:', process.env.REPLICATE_API_TOKEN ? '***' + process.env.REPLICATE_API_TOKEN.slice(-4) : 'not set');
            
            // Test the connection by attempting to get a prediction
            const prediction = await this.replicate.predictions.create({
                version: this.MODEL_VERSION,
                input: {
                    prompt: "test",
                    ...this.DEFAULT_CONFIG
                }
            });
            
            console.log('Replicate API connection successful');
            return true;
        } catch (error) {
            console.error('Replicate API connection test failed:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            throw new Error(`API connection test failed: ${error.message}`);
        }
    }

    async generateSticker(prompt, customConfig = {}) {
        if (!prompt) {
            throw new Error('Prompt is required for sticker generation');
        }

        try {
            // Test connection first
            await this.testConnection();

            console.log('Configuring sticker generation...');
            const input = {
                ...this.DEFAULT_CONFIG,
                ...customConfig,
                prompt
            };

            console.log('Starting sticker generation with input:', {
                ...input,
                prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '')
            });

            const output = await this.replicate.run(this.MODEL_ID, { input });

            if (!output || !Array.isArray(output) || output.length === 0) {
                throw new Error('Invalid output from Replicate API');
            }

            console.log('Sticker generation completed successfully');
            console.log('Output URLs:', output);
            
            return output;
        } catch (error) {
            console.error('Error in generateSticker:', error.message);
            console.error('Error stack:', error.stack);

            // Handle specific API errors
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;

                if (status === 401 || status === 403) {
                    throw new Error('Invalid or expired API token. Please check your Replicate API token.');
                } else if (status === 429) {
                    throw new Error('Rate limit exceeded. Please try again later.');
                } else if (data && data.error) {
                    throw new Error(`API Error: ${data.error}`);
                }
            }

            throw new Error(`Failed to generate sticker: ${error.message}`);
        }
    }
}

export default new ImageGeneratorService();
