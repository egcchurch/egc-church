'use strict';

// Shared role definitions — imported by seedRoles.js and index.js (migrateRolesV1).
// Keep this in sync with docs/PERMISSIONS.md.

const ALL_PERMISSIONS = [
  'sermons.manage',
  'events.manage',
  'blog.manage',
  'team.manage',
  'gallery.manage',
  'music.manage',
  'devotional.manage',
  'groups.manage',
  'homepage.manage',
  'notifications.send',
  'prayer.moderate',
  'connect.view',
  'users.approve',
  'users.assign_roles',
];

const DEFAULT_ROLES = [
  {
    id: 'administrator',
    displayName: 'Administrator',
    description: 'Full access to all admin sections (equivalent to the old editor role)',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
  },
  {
    id: 'pastor',
    displayName: 'Pastor',
    description: 'Sermons, devotionals, events, blog, and notifications',
    permissions: ['sermons.manage', 'devotional.manage', 'events.manage', 'blog.manage', 'notifications.send'],
    isSystem: true,
  },
  {
    id: 'deacon',
    displayName: 'Deacon',
    description: 'Approves members, moderates prayer requests, views connect form submissions',
    permissions: ['users.approve', 'prayer.moderate', 'connect.view'],
    isSystem: true,
  },
  {
    id: 'media_helper',
    displayName: 'Media Helper',
    description: 'Manages sermons, music library, and photo galleries',
    permissions: ['sermons.manage', 'music.manage', 'gallery.manage'],
    isSystem: true,
  },
  {
    id: 'communications',
    displayName: 'Communications',
    description: 'Blog, homepage content, notifications, and events',
    permissions: ['blog.manage', 'homepage.manage', 'notifications.send', 'events.manage'],
    isSystem: true,
  },
  {
    id: 'prayer_lead',
    displayName: 'Prayer Team Lead',
    description: 'Moderates prayer requests and sends notifications',
    permissions: ['prayer.moderate', 'notifications.send'],
    isSystem: true,
  },
  {
    id: 'content_editor',
    displayName: 'Content Editor',
    description: 'All content management permissions — migration target for existing editor users',
    permissions: [
      'sermons.manage', 'events.manage', 'blog.manage', 'team.manage',
      'gallery.manage', 'music.manage', 'devotional.manage', 'groups.manage',
      'homepage.manage',
    ],
    isSystem: true,
  },
];

module.exports = { ALL_PERMISSIONS, DEFAULT_ROLES };
