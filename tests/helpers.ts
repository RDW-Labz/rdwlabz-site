import type { Page } from '@playwright/test';

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
