import { loadFixture } from './timelineSchema/fixtures/loadFixture.js';
import { createTimeline, saveTimeline } from './src/services/timelineStorage.js';
import { prisma } from './src/db/prisma.js';

const user = await prisma.user.findFirst();
if (!user) { console.error('No user found'); process.exit(1); }

const doc = loadFixture('exodus-cluster');
const tl = await createTimeline(user.id, {
  title: doc.meta.title,
  author: doc.meta.author,
  defaultChronology: doc.meta.defaultChronology,
  yearStart: doc.meta.yearRange[0],
  yearEnd: doc.meta.yearRange[1],
});
await saveTimeline(tl.id, doc);
console.log('Seeded timeline:', tl.id, tl.title);
