import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';
import { hasDb } from "./testEnv";

describe.skipIf(!hasDb())('Blog API', () => {
  let testPostId: number;
  
  describe('Blog Posts CRUD', () => {
    it('should create a new blog post', async () => {
      const post = await db.createBlogPost({
        titleEn: 'Test Blog Post',
        titleKu: 'بابەتی تاقیکردنەوە',
        contentEn: 'This is a test blog post content.',
        contentKu: 'ئەمە ناوەڕۆکی بابەتی تاقیکردنەوەیە.',
        summaryEn: 'Test summary',
        category: 'announcement',
        status: 'draft',
        isFeatured: false,
        authorId: 1,
      });
      
      expect(post).toBeDefined();
      expect(post.id).toBeDefined();
      expect(post.titleEn).toBe('Test Blog Post');
      expect(post.titleKu).toBe('بابەتی تاقیکردنەوە');
      expect(post.status).toBe('draft');
      expect(post.slug).toBeDefined();
      
      testPostId = post.id;
    });
    
    it('should get blog post by ID', async () => {
      const post = await db.getBlogPostById(testPostId);
      
      expect(post).toBeDefined();
      expect(post?.id).toBe(testPostId);
      expect(post?.titleEn).toBe('Test Blog Post');
    });
    
    it('should get all blog posts', async () => {
      const posts = await db.getAllBlogPosts();
      
      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);
    });
    
    it('should update blog post', async () => {
      const updated = await db.updateBlogPost(testPostId, {
        titleEn: 'Updated Test Blog Post',
        status: 'published',
        isFeatured: true,
        publishedAt: new Date(),
      });
      
      expect(updated).toBeDefined();
      expect(updated?.titleEn).toBe('Updated Test Blog Post');
      expect(updated?.status).toBe('published');
      expect(updated?.isFeatured).toBe(true);
    });
    
    it('should get published blog posts', async () => {
      const posts = await db.getPublishedBlogPosts();
      
      expect(Array.isArray(posts)).toBe(true);
      // Should include our published test post
      const found = posts.find(p => p.id === testPostId);
      expect(found).toBeDefined();
    });
    
    it('should get featured blog posts', async () => {
      const posts = await db.getFeaturedBlogPosts();
      
      expect(Array.isArray(posts)).toBe(true);
      // Should include our featured test post
      const found = posts.find(p => p.id === testPostId);
      expect(found).toBeDefined();
    });
    
    it('should get blog post by slug', async () => {
      const post = await db.getBlogPostById(testPostId);
      if (post?.slug) {
        const foundBySlug = await db.getBlogPostBySlug(post.slug);
        expect(foundBySlug).toBeDefined();
        expect(foundBySlug?.id).toBe(testPostId);
      }
    });
    
    it('should get blog posts by category', async () => {
      const posts = await db.getBlogPostsByCategory('announcement');
      
      expect(Array.isArray(posts)).toBe(true);
    });
    
    it('should increment view count', async () => {
      const beforePost = await db.getBlogPostById(testPostId);
      const beforeCount = beforePost?.viewCount || 0;
      
      await db.incrementBlogViewCount(testPostId);
      
      const afterPost = await db.getBlogPostById(testPostId);
      expect(afterPost?.viewCount).toBe(beforeCount + 1);
    });
    
    it('should delete blog post', async () => {
      const deleted = await db.deleteBlogPost(testPostId);
      
      expect(deleted).toBe(true);
      
      const post = await db.getBlogPostById(testPostId);
      expect(post).toBeNull();
    });
  });
  
  describe('Blog Post Validation', () => {
    it('should generate slug automatically if not provided', async () => {
      const post = await db.createBlogPost({
        titleEn: 'Auto Slug Test',
        contentEn: 'Content for auto slug test',
        category: 'news',
        status: 'draft',
        authorId: 1,
      });
      
      expect(post.slug).toBeDefined();
      expect(post.slug).toContain('auto-slug-test');
      
      // Cleanup
      await db.deleteBlogPost(post.id);
    });
    
    it('should handle different categories', async () => {
      const categories = ['announcement', 'news', 'promotion', 'update', 'guide'] as const;
      
      for (const category of categories) {
        const post = await db.createBlogPost({
          titleEn: `Test ${category}`,
          contentEn: `Content for ${category}`,
          category,
          status: 'draft',
          authorId: 1,
        });
        
        expect(post.category).toBe(category);
        
        // Cleanup
        await db.deleteBlogPost(post.id);
      }
    });
  });
});
