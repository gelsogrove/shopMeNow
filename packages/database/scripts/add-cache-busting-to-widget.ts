#!/usr/bin/env ts-node
/**
 * Add cache-busting parameter to widget code
 * This forces browsers to download the latest widget.js version
 */

import { prisma } from '../src/generated/prisma';

const VERSION = '186'; // Current Heroku release version

async function addCacheBustingToWidget() {
  console.log('🔄 Updating widget code with cache-busting parameter...');

  // Get all workspaces with widget code
  const workspaces = await prisma.workspace.findMany({
    where: {
      widgetCode: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      widgetCode: true,
    },
  });

  console.log(`📋 Found ${workspaces.length} workspaces with widget code`);

  for (const workspace of workspaces) {
    if (!workspace.widgetCode) continue;

    // Check if widget code already has version parameter
    if (workspace.widgetCode.includes('widget.js?v=')) {
      console.log(`⏭️  Skipping ${workspace.name} - already has version parameter`);
      continue;
    }

    // Add version parameter to widget.js URL
    const updatedCode = workspace.widgetCode.replace(
      /src="([^"]*\/widget\.js)"/g,
      `src="$1?v=${VERSION}"`
    );

    // Update workspace
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { widgetCode: updatedCode },
    });

    console.log(`✅ Updated ${workspace.name} (${workspace.id})`);
  }

  console.log('✅ Widget code updated successfully!');
}

addCacheBustingToWidget()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
