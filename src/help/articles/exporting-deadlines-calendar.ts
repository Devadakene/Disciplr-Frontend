import { HelpArticle } from '../types'

export const exportingDeadlinesCalendarArticle: HelpArticle = {
  slug: 'exporting-deadlines-calendar',
  title: 'Exporting deadlines to your calendar',
  category: 'Vaults',
  summary: 'Sync milestone dates and verification deadlines to Google Calendar, Apple Calendar, or Outlook.',
  keywords: ['export', 'deadlines', 'calendar', 'ics', 'sync', 'reminders', 'schedule'],
  body: `Never miss a commitment deadline by exporting your active vault milestones directly into your preferred calendar application.

### Supported Calendar Formats
Disciplr supports standard iCalendar (.ics) exports compatible with:
- Google Calendar
- Apple Calendar
- Microsoft Outlook
- Any CalDAV-compliant calendar client

### How to Export
1. Navigate to the specific vault view under \`/vaults/:id\`.
2. Look for the **Export to Calendar** button beside the deadline banner.
3. Download the generated \`.ics\` file or click the webcal link to subscribe.
4. Your calendar will now show scheduled reminders at 48 hours, 24 hours, and 2 hours prior to the verification deadline.`,
  related: ['creating-a-vault', 'how-verification-works', 'what-happens-on-failure'],
  updatedAt: '2026-03-15',
}
