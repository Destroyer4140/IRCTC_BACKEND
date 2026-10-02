const Redis = require('ioredis');
const { config } = require('.');
const logger = require('./logger');

class RedisClient {
     static instance = null;
     static isConnected = false;

     constructor() {
          throw new Error("Use RedisClient.redis or RedisClient.getInstance() instead of new.");
     }

     static getInstance() {
          if (!RedisClient.instance) {
               const redisUrl = config?.REDIS_URL || 'redis://127.0.0.1:6379';
               logger.info(`[Redis] Initializing connection to: ${redisUrl}`);
               
               RedisClient.instance = new Redis(redisUrl, {
                    // Retry strategy with exponential backoff up to 2 seconds
                    retryStrategy: (times) => {
                         const delay = Math.min(times * 50, 2000);
                         return delay;
                    },
                    // Disable maxRetriesPerRequest or set to null so ioredis queues commands during brief reconnects
                    maxRetriesPerRequest: null,
                    // Keep offline queue enabled so commands sent during initialization don't immediately throw errors
                    enableOfflineQueue: true,
                    // Prevent infinite reconnect loops if server is completely down
                    maxLoadingRetryTime: 5000,
                    // Reconnect on specific connection errors
                    reconnectOnError: (err) => {
                         const targetError = "READONLY";
                         if (err.message.includes(targetError)) {
                              return true; // Force reconnect
                         }
                         return false;
                    }
               });

               RedisClient.setupEventListeners();
          }
          return RedisClient.instance;
     }

     static setupEventListeners() {
          if (!RedisClient.instance) return;

          // Remove old listeners to prevent duplicate execution
          RedisClient.instance.removeAllListeners();

          RedisClient.instance.on('connect', () => {
               logger.info("Redis socket connected");
          });

          RedisClient.instance.on('ready', () => {
               RedisClient.isConnected = true;
               logger.info("Redis client ready to process commands");
          });

          RedisClient.instance.on('error', (error) => {
               RedisClient.isConnected = false;
               logger.error("Redis connection error:", error);
          });

          RedisClient.instance.on('close', () => {
               RedisClient.isConnected = false;
               logger.warn("Redis connection closed");
          });

          RedisClient.instance.on('reconnecting', (time) => {
               logger.warn(`Reconnecting to Redis in ${time}ms...`);
          });

          RedisClient.instance.on('end', () => {
               RedisClient.isConnected = false;
               logger.warn("Redis connection ended");
          });
     }

     static async closeConnection() {
          if (RedisClient.instance) {
               try {
                    await RedisClient.instance.quit();
                    logger.info("Redis connection gracefully closed");
               } catch (error) {
                    logger.error("Error closing Redis connection:", error);
               } finally {
                    RedisClient.instance = null;
                    RedisClient.isConnected = false;
               }
          }
     }

     static isReady() {
          return RedisClient.isConnected;
     }

     static async testConnection() {
          try {
               const client = RedisClient.getInstance();
               const result = await client.ping();
               return result === 'PONG';
          } catch (error) {
               logger.error("Redis connection test failed:", error);
               return false;
          }
     }
}

module.exports = {
     get redis() {
          return RedisClient.getInstance();
     },
     RedisClient
};