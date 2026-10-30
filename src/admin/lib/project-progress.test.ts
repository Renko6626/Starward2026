import { expect,it } from 'vitest';
import { summarizeProjectProgress } from './project-progress';
import { summarizeWorkReview } from '../../shared/work-submissions';
it('counts only formally submitted works', () => {
  expect(summarizeProjectProgress([{review:summarizeWorkReview(null,null)}, {review:summarizeWorkReview(1,null)},
    {review:summarizeWorkReview(2,{submissionId:'v1',versionNumber:1,decision:'approved'})}])).toEqual({drafts:1,submitted:2});
});
