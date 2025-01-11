# Sticker Generator App

An AI-powered sticker generation application with real-time collaboration features.

## Features

- Image generation using Stable Diffusion XL
- Real-time collaboration
- Collection management
- Advanced image processing
- Export options
- Analytics visualizations

## Directory Structure

```
├── middleware/     # Authentication and authorization middleware
├── models/         # MongoDB models
├── public/         # Static files and frontend code
├── routes/         # API routes
├── services/       # Business logic services
├── utils/         # Utility functions
├── .env.example   # Example environment variables
├── package.json   # Dependencies and scripts
└── server.js      # Main application file
```

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sticker.git
cd sticker
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example` and add your configuration.

4. Start the server:
```bash
npm start
```

## Environment Variables

Required environment variables:
- `MONGODB_URI`: MongoDB connection string
- `PORT`: Server port (default: 3005)
- `JWT_SECRET`: Secret for JWT token generation
- `REPLICATE_API_TOKEN`: API token from replicate.com

## API Routes

- `/api/auth/*`: Authentication routes
- `/api/collections/*`: Collection management
- `/api/generations/*`: Image generation
- `/api/profile/*`: User profile management

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
