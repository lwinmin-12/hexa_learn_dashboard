import { describe, expect, it } from 'vitest';
import { setTokenGetter } from '@/lib/api';
import { COURSE_IDS } from './data';
import { getCourse, getCourses } from '@/features/courses/api';

describe('page admin mock access', () => {
  it('limits course lists and hides courses outside the assigned set', async () => {
    setTokenGetter(async () => 'mock-page_admin');

    const courses = await getCourses({ page: 1, limit: 20 });
    expect(courses.data.map((course) => course.id).sort()).toEqual([COURSE_IDS.beginner, COURSE_IDS.hiragana].sort());
    await expect(getCourse(COURSE_IDS.conversation)).rejects.toMatchObject({ response: { status: 404 } });
  });
});
