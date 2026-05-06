const redis = require('../config/redis');

const cacheMiddleware = (cacheKeyPrefix) => {
  return async (req, res, next) => {
    try {
      // Create cache key from URL and query params
      const queryString = JSON.stringify(req.query);
      const cacheKey = `${cacheKeyPrefix}:${queryString}`;

      // Try to get from Redis
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        res.set('X-Cache', 'HIT');
        return res.json(JSON.parse(cachedData));
      }

      // Wrap res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        // Cache the response for 1 hour
        redis.setex(cacheKey, 3600, JSON.stringify(data)).catch(err =>
          console.error('Cache set error:', err)
        );
        res.set('X-Cache', 'MISS');
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

module.exports = cacheMiddleware;
