require('dotenv').config();

module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    apiKey: process.env.API_KEY || 'dev-api-key'
  },

  // OCR Provider Configuration
  ocr: {
    provider: process.env.OCR_PROVIDER || 'tesseract',
    language: process.env.OCR_LANGUAGE || 'eng',
    dpi: parseInt(process.env.OCR_DPI) || 300,
    confidenceThreshold: parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD) || 0.6,

    // Google Cloud Vision
    googleVision: {
      credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    },

    // Azure Computer Vision
    azureCV: {
      endpoint: process.env.AZURE_CV_ENDPOINT,
      key: process.env.AZURE_CV_KEY
    }
  },

  // Storage Configuration
  storage: {
    backend: process.env.STORAGE_BACKEND || 'local',

    // Local Storage
    local: {
      path: process.env.LOCAL_STORAGE_PATH || './storage'
    },

    // AWS S3
    s3: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET
    },

    // Google Cloud Storage
    gcs: {
      credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      bucket: process.env.GCS_BUCKET
    },

    // MongoDB
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/documents',
      dbName: process.env.MONGODB_DB_NAME || 'documents'
    },

    // PostgreSQL
    postgresql: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      database: process.env.POSTGRES_DB || 'documents',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    }
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  },

  // Processing Configuration
  processing: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB) || 50,
    supportedFormats: (process.env.SUPPORTED_FORMATS || 'pdf,png,jpg,jpeg,tiff,bmp,docx,xlsx').split(','),
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 5,
    jobTimeoutMs: parseInt(process.env.JOB_TIMEOUT_MS) || 300000
  },

  // Webhook Configuration
  webhook: {
    url: process.env.WEBHOOK_URL,
    secret: process.env.WEBHOOK_SECRET
  },

  // AI Configuration
  ai: {
    provider: process.env.AI_PROVIDER || 'ollama', // 'ollama' or 'gemini'
    enabled: process.env.AI_ENABLED === 'true' || true,
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest'
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3:8b'
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log'
  }
};
