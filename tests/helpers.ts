import type { Page } from '@playwright/test';
import { activeCategories, allProjects, buildPhrase, categories, site } from '../src/lib/projects';

/** Measure final colors, not mid-fade: finish reveals, entrance animations and transitions. */
export async function settleMotion(page: Page) {
  await page.addStyleTag({ content: '*{transition:none!important}' });
  await page.evaluate(() => {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-revealed'));
    document.getAnimations().forEach((a) => {
      if (a.effect?.getTiming().iterations !== Infinity) a.finish();
    });
  });
}

/** What the site should show, computed from the same data the build uses. */
export const shelf = {
  active: activeCategories.map((c) => c.id),
  activeLabels: activeCategories.map((c) => c.label),
  hidden: categories.filter((c) => !activeCategories.includes(c)).map((c) => c.id),
  projects: allProjects(),
  phrase: buildPhrase,
  site,
};

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
