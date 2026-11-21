import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ActivityCard,
  AgeGroupSelector,
  Badge,
  Button,
  Card,
  COLOR_TOKENS,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  Input,
  MobileBottomNav,
  Modal,
  Navbar,
  PageHeader,
  ProgressIndicator,
  Select,
  Sidebar,
  SkeletonCard,
  Tabs,
  TYPOGRAPHY_SCALE,
  VideoPlayer,
} from '../index';
import { CANONICAL_AGE_GROUPS, EDITORIAL_IMAGES } from '../../shared/domain';

test('Design tokens cover all 8 required color roles and 7 typography levels', () => {
  assert.equal(COLOR_TOKENS.length, 8);
  assert.equal(TYPOGRAPHY_SCALE.length, 7);
  const roles = COLOR_TOKENS.map((t) => t.role);
  assert.ok(roles.includes('Primary'));
  assert.ok(roles.includes('Secondary'));
  assert.ok(roles.includes('Accent'));
  assert.ok(roles.includes('Highlight'));
});

test('Button renders primary, loading (aria-busy), and disabled states', () => {
  const loadingHtml = renderToStaticMarkup(
    <Button variant="primary" loading>
      Saving
    </Button>
  );
  assert.match(loadingHtml, /aria-busy="true"/);
  assert.match(loadingHtml, /disabled=""/);
  assert.match(loadingHtml, /min-h-\[44px\]/);

  const secondaryHtml = renderToStaticMarkup(<Button variant="secondary">Cancel</Button>);
  assert.match(secondaryHtml, /bg-cream/);
});

test('Input, Select, and DatePicker wire WCAG error alerts and baby age preview', () => {
  const inputHtml = renderToStaticMarkup(
    <Input label="Caregiver email" error="Please enter a valid email" value="bad" onChange={() => {}} />
  );
  assert.match(inputHtml, /aria-invalid="true"/);
  assert.match(inputHtml, /role="alert"/);
  assert.match(inputHtml, /Please enter a valid email/);

  const selectHtml = renderToStaticMarkup(
    <Select
      label="Domain"
      value="sensory"
      onChange={() => {}}
      options={[{ value: 'sensory', label: 'Sensory development' }]}
    />
  );
  assert.match(selectHtml, /Sensory development/);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 7);
  const dobIso = sixMonthsAgo.toISOString().slice(0, 10);
  const dateHtml = renderToStaticMarkup(
    <DatePicker label="Date of birth" value={dobIso} onChange={() => {}} showBabyAgePreview />
  );
  assert.match(dateHtml, /6–9 months stage/);
});

test('AgeGroupSelector renders all 8 canonical age groups with aria-pressed', () => {
  const html = renderToStaticMarkup(
    <AgeGroupSelector selectedSlug="6-9m" onSelect={() => {}} />
  );
  for (const band of CANONICAL_AGE_GROUPS) {
    assert.ok(html.includes(band.label), `Expected age band ${band.label}`);
  }
  assert.match(html, /aria-pressed="true"/);
});

test('ProgressIndicator renders WCAG progressbar role and clamped aria values', () => {
  const linearHtml = renderToStaticMarkup(
    <ProgressIndicator value={120} max={100} label="Completion" />
  );
  assert.match(linearHtml, /role="progressbar"/);
  assert.match(linearHtml, /aria-valuenow="100"/);

  const ringHtml = renderToStaticMarkup(
    <ProgressIndicator variant="ring" value={88} label="Instruction Match" />
  );
  assert.match(ringHtml, /88%/);
});

test('Tabs, Modal, ConfirmDialog, and Badges expose accessible semantics', () => {
  const tabsHtml = renderToStaticMarkup(
    <Tabs
      activeTabId="today"
      onChange={() => {}}
      tabs={[
        { id: 'today', label: 'Today', count: 3 },
        { id: 'feedback', label: 'Feedback' },
      ]}
    />
  );
  assert.match(tabsHtml, /role="tablist"/);
  assert.match(tabsHtml, /aria-selected="true"/);

  const closedModalHtml = renderToStaticMarkup(
    <Modal open={false} onClose={() => {}} title="Hidden">
      Hidden content
    </Modal>
  );
  assert.equal(closedModalHtml, '');

  const openConfirmHtml = renderToStaticMarkup(
    <ConfirmDialog
      open
      onClose={() => {}}
      onConfirm={() => {}}
      title="Delete Video"
      message="Confirm permanent removal."
      destructive
    />
  );
  assert.match(openConfirmHtml, /role="dialog"/);
  assert.match(openConfirmHtml, /aria-modal="true"/);

  const badgeHtml = renderToStaticMarkup(<Badge tone="sage">Reviewed</Badge>);
  assert.match(badgeHtml, /Reviewed/);
});

test('Navigation, Cards, VideoPlayer, ActivityCard, EmptyState, Skeleton, and PageHeader render cleanly', () => {
  const navHtml = renderToStaticMarkup(
    <Navbar
      items={[{ id: 'today', label: 'Today' }]}
      activeId="today"
      onSelect={() => {}}
    />
  );
  assert.match(navHtml, /LittleSteps/);

  const sidebarHtml = renderToStaticMarkup(
    <Sidebar
      title="Navigation"
      items={[{ id: 'a', label: 'Home', icon: <span>*</span> }]}
      activeId="a"
      onSelect={() => {}}
    />
  );
  assert.match(sidebarHtml, /aria-current="page"/);

  const bottomNavHtml = renderToStaticMarkup(
    <MobileBottomNav
      fixed={false}
      items={[{ id: 'today', label: 'Today', icon: <span>*</span> }]}
      activeId="today"
      onSelect={() => {}}
    />
  );
  assert.match(bottomNavHtml, /aria-label="Mobile primary navigation"/);

  const activityHtml = renderToStaticMarkup(
    <ActivityCard
      title="Household Texture Basket"
      summary="Safe everyday sensory objects."
      domainName="Sensory development"
      ageGroupLabel="6–9 months"
      durationMinutes={5}
      materials={['Cotton mat', 'Wooden spoon']}
      posterUrl={EDITORIAL_IMAGES.sensoryLinen}
      statusText="Ready Today"
      onAction={() => {}}
    />
  );
  assert.match(activityHtml, /Household Texture Basket/);

  const videoHtml = renderToStaticMarkup(
    <VideoPlayer
      title="Demo"
      posterUrl={EDITORIAL_IMAGES.sensoryLinen}
      chapters={[{ id: '1', stepNumber: 1, title: 'Step 1', caption: 'Calm setup' }]}
      privacyNote="Private stream"
    />
  );
  assert.match(videoHtml, /Private stream/);

  const miscHtml = renderToStaticMarkup(
    <div>
      <PageHeader title="Design System" description="Reference" />
      <Card>Content</Card>
      <EmptyState title="Empty" description="Nothing here yet" />
      <SkeletonCard />
    </div>
  );
  assert.match(miscHtml, /Design System/);
  assert.match(miscHtml, /role="status"/);
});
