# Lira Compensation Simulator - Complete UI/UX Design System Prompt

## Design Philosophy
The application follows a clean, professional, modern design system with a light theme. The design emphasizes clarity, consistency, and usability. It uses a semantic color system where colors are defined by purpose (background, foreground, primary, etc.) rather than specific hex values, allowing for easy theme customization.

---

## COLOR SYSTEM

### Base Colors
- **Main Background**: Pure white (`#ffffff`)
- **Card/Panel Background**: Pure white (`#ffffff`) - same as main background
- **Muted Background**: Very light gray (`#f3f3f5`) - used for hover states, subtle backgrounds
- **Main Text**: Very dark, almost black (`oklch(0.145 0 0)`) - approximately `#1E1E1E`
- **Muted Text**: Medium gray (`#717182`) - for secondary text, labels, descriptions
- **Subtle Text**: Light gray (`#9ca3af`) - for very subtle text

### Primary Brand Color
- **Primary**: Very dark blue/black (`#030213`) - used for primary buttons, active states, brand elements
- **Primary Hover**: Slightly darker (`#02010f`)
- **Primary Foreground**: Pure white (`oklch(1 0 0)`) - text on primary buttons
- **Primary Light Variant**: Very light gray (`#f3f3f5`)

### Secondary Colors
- **Secondary Background**: Very light gray-blue (`oklch(0.95 0.0058 264.53)`)
- **Secondary Foreground**: Very dark (`#030213`) - text on secondary elements

### Accent Colors
- **Accent Background**: Light gray (`#e9ebef`) - used for hover states on interactive elements
- **Accent Foreground**: Very dark (`#030213`) - text on accent backgrounds

### Muted Colors
- **Muted Background**: Light gray (`#ececf0`)
- **Muted Foreground**: Medium gray (`#717182`)

### Border Colors
- **Default Border**: Very light black with 10% opacity (`rgba(0, 0, 0, 0.1)`)
- **Subtle Border**: Very light gray (`#f3f3f5`)

### Input Colors
- **Input Background**: Very light gray (`#f3f3f5`)
- **Input Border**: Transparent (no visible border by default)
- **Input Focus Ring**: Medium gray (`oklch(0.708 0 0)`)

### Status Colors
- **Success**: Green (`#10b981`)
- **Warning**: Orange (`#f59e0b`)
- **Error/Destructive**: Red (`#d4183d`)
- **Info**: Blue (`#3b82f6`)

### Chart Colors
- **Chart 1**: Orange (`oklch(0.646 0.222 41.116)`)
- **Chart 2**: Green (`oklch(0.6 0.118 184.704)`)
- **Chart 3**: Blue (`oklch(0.398 0.07 227.392)`)
- **Chart 4**: Yellow (`oklch(0.828 0.189 84.429)`)
- **Chart 5**: Orange-yellow (`oklch(0.769 0.188 70.08)`)

### Sidebar Colors
- **Sidebar Background**: Almost white (`oklch(0.985 0 0)`)
- **Sidebar Text**: Very dark (`oklch(0.145 0 0)`)
- **Sidebar Border**: Very light gray (`oklch(0.922 0 0)`)
- **Sidebar Accent**: Very light gray (`oklch(0.97 0 0)`) - for hover states

---

## TYPOGRAPHY

### Font Family
- **Primary Font**: System UI sans-serif stack (`ui-sans-serif, system-ui, sans-serif`)
- **Monospace Font**: System monospace (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas`)

### Font Sizes
- **Extra Small (xs)**: `0.75rem` (12px)
- **Small (sm)**: `0.875rem` (14px)
- **Base**: `1rem` (16px) - default body text
- **Large (lg)**: `1.125rem` (18px)
- **Extra Large (xl)**: `1.25rem` (20px)
- **2XL**: `1.5rem` (24px)

### Font Weights
- **Normal**: `400`
- **Medium**: `500` - used for labels, buttons
- **Semibold**: `600` - used for headings, emphasized text

### Line Heights
- **Tight**: `1` (leading-none) - for single-line headings
- **Normal**: `1.5` - default for body text
- **Relaxed**: `1.75` - for large text

### Text Colors
- **Primary Text**: Very dark (`oklch(0.145 0 0)`) - main content
- **Muted Text**: Medium gray (`#717182`) - secondary content, descriptions
- **On Primary**: White - text on primary colored backgrounds
- **On Secondary**: Very dark - text on secondary backgrounds

---

## SPACING SYSTEM

The spacing system uses a 4px base unit (0.25rem = 4px).

### Common Spacing Values
- **0.5**: `0.125rem` (2px)
- **1**: `0.25rem` (4px)
- **1.5**: `0.375rem` (6px)
- **2**: `0.5rem` (8px)
- **3**: `0.75rem` (12px)
- **4**: `1rem` (16px)
- **6**: `1.5rem` (24px)
- **8**: `2rem` (32px)
- **12**: `3rem` (48px)

### Component-Specific Spacing
- **Button Padding (default)**: `px-4 py-2` (16px horizontal, 8px vertical)
- **Button Padding (small)**: `px-3` (12px horizontal)
- **Button Padding (large)**: `px-6` (24px horizontal)
- **Card Padding**: `px-6 pt-6 pb-6` (24px all around)
- **Card Header Padding**: `px-6 pt-6` (24px horizontal, 24px top)
- **Card Content Padding**: `px-6` (24px horizontal)
- **Input Padding**: `px-3 py-1` (12px horizontal, 4px vertical)
- **Table Cell Padding**: `p-2` (8px all around)
- **Table Header Height**: `h-10` (40px)
- **Dialog Padding**: `p-6` (24px all around)
- **Gap Between Elements**: Typically `gap-2` (8px), `gap-4` (16px), or `gap-6` (24px)

---

## BORDER RADIUS

### Radius Values
- **Extra Small (xs)**: `0.125rem` (2px) - used for small elements like dialog close buttons
- **Small (sm)**: `0.25rem` (4px) - used for select items
- **Default (md)**: `0.375rem` (6px) - **THIS IS THE PRIMARY RADIUS** used for buttons, inputs, selects, badges
- **Large (lg)**: `0.625rem` (10px) - used for dialogs
- **Extra Large (xl)**: `0.75rem` (12px) - used for cards
- **Full**: `9999px` (fully rounded) - used for circular elements like avatars, radio buttons, switch thumbs

### Component-Specific Radius
- **Buttons**: `rounded-md` (6px) - **rounded, not square**
- **Cards**: `rounded-xl` (12px) - **rounded corners, not square**
- **Inputs**: `rounded-md` (6px) - **rounded, not square**
- **Selects**: `rounded-md` (6px) - **rounded, not square**
- **Badges**: `rounded-md` (6px) - **rounded, not square**
- **Dialogs**: `rounded-lg` (10px) - **rounded, not square**
- **Checkboxes**: `rounded-[4px]` (4px) - slightly rounded square
- **Radio Buttons**: `rounded-full` (fully circular)
- **Switch**: `rounded-full` (fully rounded pill shape)
- **Switch Thumb**: `rounded-full` (fully circular)

---

## BUTTONS

### Button Variants

#### Default (Primary)
- **Background**: Primary color (very dark blue/black `#030213`)
- **Text**: White
- **Hover**: Primary color at 90% opacity (`bg-primary/90`)
- **Shape**: Rounded (`rounded-md` = 6px) - **NOT square**
- **Height**: `h-9` (36px) for default size
- **Padding**: `px-4 py-2` (16px horizontal, 8px vertical)
- **Font**: `text-sm font-medium`
- **Transition**: `transition-all` - smooth color transitions

#### Destructive
- **Background**: Red (`#d4183d`)
- **Text**: White
- **Hover**: Red at 90% opacity
- **Shape**: Rounded (`rounded-md` = 6px) - **NOT square**

#### Outline
- **Background**: Transparent/white
- **Border**: 1px solid border color
- **Text**: Foreground color
- **Hover**: Accent background with accent foreground text
- **Shape**: Rounded (`rounded-md` = 6px) - **NOT square**

#### Secondary
- **Background**: Secondary color (very light gray-blue)
- **Text**: Secondary foreground (very dark)
- **Hover**: Secondary at 80% opacity
- **Shape**: Rounded (`rounded-md` = 6px) - **NOT square**

#### Ghost
- **Background**: Transparent
- **Text**: Foreground color
- **Hover**: Accent background with accent foreground text
- **Shape**: Rounded (`rounded-md` = 6px) - **NOT square**

#### Link
- **Background**: Transparent
- **Text**: Primary color
- **Decoration**: Underline on hover with `underline-offset-4`
- **Shape**: No border radius (text link)

### Button Sizes
- **Small (sm)**: `h-8` (32px height), `px-3` (12px horizontal), `gap-1.5` (6px gap)
- **Default**: `h-9` (36px height), `px-4` (16px horizontal), `gap-2` (8px gap)
- **Large (lg)**: `h-10` (40px height), `px-6` (24px horizontal), `gap-2` (8px gap)
- **Icon**: `size-9` (36px × 36px square)

### Button States
- **Disabled**: `opacity-50`, `pointer-events-none`, `cursor-not-allowed`
- **Focus**: `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]` - 3px ring
- **Invalid**: `aria-invalid:ring-destructive/20` - red ring at 20% opacity

### Button Icons
- **Icon Size**: `size-4` (16px × 16px) by default
- **Icon Gap**: `gap-2` (8px) between icon and text
- **Icon Behavior**: `pointer-events-none`, `shrink-0` (doesn't shrink)

---

## CARDS

### Card Structure
- **Background**: White (`bg-card`)
- **Text**: Card foreground color (very dark)
- **Border**: 1px solid border color
- **Border Radius**: `rounded-xl` (12px) - **rounded corners, not square**
- **Padding**: `gap-6` (24px) between card sections
- **Shadow**: `shadow-sm` - subtle shadow (optional, some cards use `border-0` with `shadow-sm`)

### Card Sections
- **Card Header**: `px-6 pt-6` (24px horizontal, 24px top), `gap-1.5` (6px) between title and description
- **Card Title**: No specific padding, uses `leading-none` for tight line height
- **Card Description**: Uses `text-muted-foreground` (medium gray)
- **Card Content**: `px-6` (24px horizontal), `[&:last-child]:pb-6` (24px bottom padding if last child)
- **Card Footer**: `px-6 pb-6` (24px horizontal, 24px bottom), `flex items-center`

### Card Layout
- **Flex Direction**: `flex flex-col` (vertical stacking)
- **Gap**: `gap-6` (24px) between major sections

---

## INPUTS

### Input Styling
- **Background**: Very light gray (`#f3f3f5`)
- **Border**: Transparent by default (`border-input` but transparent)
- **Border Radius**: `rounded-md` (6px) - **rounded, not square**
- **Height**: `h-9` (36px)
- **Padding**: `px-3 py-1` (12px horizontal, 4px vertical)
- **Font**: `text-base` (16px) on desktop, `text-sm` (14px) on mobile
- **Text Color**: Foreground color
- **Placeholder**: Muted foreground color (medium gray)

### Input States
- **Default**: Light gray background, transparent border
- **Focus**: `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]` - 3px focus ring
- **Invalid**: `aria-invalid:ring-destructive/20 aria-invalid:border-destructive` - red border and ring
- **Disabled**: `opacity-50`, `cursor-not-allowed`, `pointer-events-none`

### Input Transitions
- **Transition**: `transition-[color,box-shadow]` - smooth color and shadow changes

### Textarea
- **Resize**: `resize-vertical` - can only resize vertically
- **Same styling as Input**: Same background, border, radius, padding

---

## TABLES

### Table Structure
- **Container**: `overflow-x-auto` - horizontal scrolling if needed
- **Table**: `w-full caption-bottom text-sm` - full width, caption at bottom, small text

### Table Header
- **Background**: Secondary background (very light gray-blue) or muted background
- **Text**: Muted foreground (medium gray), `uppercase text-xs font-medium`
- **Height**: `h-10` (40px)
- **Padding**: `px-2` (8px horizontal)
- **Alignment**: `text-left align-middle`
- **Border**: `border-b` (bottom border on header row)

### Table Rows
- **Background**: Background color (white)
- **Border**: `border-b` (bottom border)
- **Hover**: `hover:bg-muted/50` - muted background at 50% opacity
- **Selected**: `data-[state=selected]:bg-muted` - muted background
- **Transition**: `transition-colors` - smooth color transitions

### Table Cells
- **Padding**: `p-2` (8px all around)
- **Alignment**: `align-middle`
- **Text**: Foreground color
- **Whitespace**: `whitespace-nowrap` - text doesn't wrap

### Table Footer
- **Background**: `bg-muted/50` - muted background at 50% opacity
- **Border**: `border-t` (top border)
- **Font**: `font-medium`

---

## DIALOGS / MODALS

### Dialog Overlay
- **Background**: Black at 50% opacity (`bg-black/50`)
- **Position**: `fixed inset-0 z-50`
- **Animation**: Fade in/out (`fade-in-0`, `fade-out-0`)

### Dialog Content
- **Background**: Background color (white)
- **Border**: 1px solid border color
- **Border Radius**: `rounded-lg` (10px) - **rounded, not square**
- **Padding**: `p-6` (24px all around)
- **Shadow**: `shadow-lg` - large shadow
- **Position**: Centered (`top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]`)
- **Max Width**: `max-w-[calc(100%-2rem)]` on mobile, `sm:max-w-lg` (32rem/512px) on desktop
- **Gap**: `gap-4` (16px) between sections
- **Animation**: Zoom and fade (`zoom-in-95`, `zoom-out-95`, `fade-in-0`, `fade-out-0`)
- **Duration**: `duration-200` (200ms)

### Dialog Close Button
- **Position**: `absolute top-4 right-4` (16px from top and right)
- **Size**: `size-4` (16px × 16px) icon
- **Opacity**: `opacity-70` default, `hover:opacity-100` on hover
- **Border Radius**: `rounded-xs` (2px)
- **Focus**: `focus:ring-2 focus:ring-offset-2`

### Dialog Header
- **Layout**: `flex flex-col gap-2`
- **Alignment**: `text-center sm:text-left` - centered on mobile, left on desktop

### Dialog Footer
- **Layout**: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`
- **Alignment**: Buttons stacked on mobile, right-aligned row on desktop

### Dialog Title
- **Font**: `text-lg leading-none font-semibold` (18px, tight line height, semibold)

### Dialog Description
- **Font**: `text-sm text-muted-foreground` (14px, medium gray)

---

## SELECTS / DROPDOWNS

### Select Trigger
- **Background**: Input background (very light gray `#f3f3f5`)
- **Border**: 1px solid input border color
- **Border Radius**: `rounded-md` (6px) - **rounded, not square**
- **Height**: `h-9` (36px) default, `h-8` (32px) small
- **Padding**: `px-3 py-2` (12px horizontal, 8px vertical)
- **Font**: `text-sm` (14px)
- **Gap**: `gap-2` (8px) between content and chevron icon
- **Focus**: `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]` - 3px ring

### Select Content (Dropdown)
- **Background**: Popover background (white)
- **Border**: 1px solid border color
- **Border Radius**: `rounded-md` (6px) - **rounded, not square**
- **Shadow**: `shadow-md` - medium shadow
- **Padding**: `p-1` (4px) around items
- **Max Height**: Uses available viewport height
- **Animation**: Fade and zoom (`fade-in-0`, `zoom-in-95`)

### Select Items
- **Padding**: `py-1.5 pr-8 pl-2` (6px vertical, 32px right for checkmark, 8px left)
- **Border Radius**: `rounded-sm` (4px) - **slightly rounded, not square**
- **Hover/Focus**: `bg-accent text-accent-foreground` - accent background
- **Selected**: `bg-accent/50 font-medium` - accent at 50% opacity, medium font weight
- **Checkmark**: `size-4` (16px) check icon, positioned `absolute right-2`

### Select Label
- **Font**: `text-xs text-muted-foreground` (12px, medium gray)
- **Padding**: `px-2 py-1.5` (8px horizontal, 6px vertical)

---

## BADGES

### Badge Styling
- **Display**: `inline-flex items-center justify-center`
- **Border Radius**: `rounded-md` (6px) - **rounded, not square**
- **Border**: 1px solid (varies by variant)
- **Padding**: `px-2 py-0.5` (8px horizontal, 2px vertical)
- **Font**: `text-xs font-medium` (12px, medium weight)
- **Width**: `w-fit` - fits content
- **Whitespace**: `whitespace-nowrap` - text doesn't wrap
- **Gap**: `gap-1` (4px) between icon and text

### Badge Variants
- **Default**: Primary background, white text, transparent border
- **Secondary**: Secondary background, secondary foreground text
- **Destructive**: Red background, white text
- **Outline**: Transparent background, foreground text, visible border

### Badge Icons
- **Icon Size**: `size-3` (12px × 12px)
- **Icon Behavior**: `pointer-events-none`

---

## SWITCHES / TOGGLES

### Switch Container
- **Background (Unchecked)**: Switch background color (`#cbced4` - light gray)
- **Background (Checked)**: Primary color
- **Shape**: `rounded-full` - **fully rounded pill shape, not square**
- **Size**: `h-[1.15rem] w-8` (18.4px height, 32px width)
- **Border**: `border-transparent`
- **Transition**: `transition-all`

### Switch Thumb
- **Background**: Card background (white) when unchecked, primary foreground (white) when checked
- **Shape**: `rounded-full` - **fully circular**
- **Size**: `size-4` (16px × 16px)
- **Position**: `translate-x-0` when unchecked, `translate-x-[calc(100%-2px)]` when checked
- **Transition**: `transition-transform`

---

## CHECKBOXES

### Checkbox Styling
- **Background (Unchecked)**: Input background (very light gray)
- **Background (Checked)**: Primary color
- **Border**: 1px solid border color
- **Border Radius**: `rounded-[4px]` (4px) - **slightly rounded square, not fully rounded**
- **Size**: `size-4` (16px × 16px)
- **Shadow**: `shadow-xs` - very subtle shadow
- **Transition**: `transition-shadow`

### Checkbox Indicator
- **Icon**: Check icon (`CheckIcon`)
- **Size**: `size-3.5` (14px × 14px)
- **Color**: Primary foreground (white) when checked

---

## RADIO BUTTONS

### Radio Button Styling
- **Background**: Input background (very light gray)
- **Border**: 1px solid input border color
- **Shape**: `rounded-full` - **fully circular, not square**
- **Size**: `size-4` (16px × 16px)
- **Aspect Ratio**: `aspect-square` - perfect circle
- **Shadow**: `shadow-xs` - very subtle shadow
- **Transition**: `transition-[color,box-shadow]`

### Radio Button Indicator
- **Icon**: Circle icon (`CircleIcon`)
- **Size**: `size-2` (8px × 8px)
- **Fill**: Primary color when selected
- **Position**: Centered absolutely

---

## LAYOUT STRUCTURE

### Application Layout
- **Container**: `flex h-screen` - full screen height, flex layout
- **Sidebar Width**: `w-64` (256px)
- **Sidebar Background**: White
- **Sidebar Border**: Right border (`border-r border-gray-200`)
- **Main Content**: `flex-1` - takes remaining space
- **Main Content Background**: Very light blue-gray (`#EEF2F8`)

### Sidebar Navigation
- **Logo Section**: `p-6 border-b border-gray-200` (24px padding, bottom border)
- **Logo Height**: `h-8` (32px)
- **Nav Items**: `p-4` (16px padding), `gap-3` (12px gap between icon and text)
- **Nav Item Padding**: `px-4 py-3` (16px horizontal, 12px vertical)
- **Nav Item Border Radius**: `rounded-lg` (10px) - **rounded, not square**
- **Active State**: Primary background (`bg-[#0052CC]`), white text
- **Hover State**: `hover:bg-gray-100` - light gray background
- **Icon Size**: `w-5 h-5` (20px × 20px)

### Top Bar
- **Background**: White
- **Border**: Bottom border (`border-b border-gray-200`)
- **Padding**: `px-6 py-4` (24px horizontal, 16px vertical)
- **Layout**: `flex items-center justify-between`

### Page Content
- **Container**: `flex-1 overflow-auto` - scrollable content area
- **Max Width**: `max-w-[1600px]` on some pages
- **Padding**: `p-8` (32px) on main pages
- **Margin**: `mx-auto` - centered

---

## SHADOWS

### Shadow Levels
- **Extra Small (xs)**: `shadow-xs` - very subtle shadow (used on checkboxes, radio buttons)
- **Small (sm)**: `shadow-sm` - subtle shadow (used on cards)
- **Medium (md)**: `shadow-md` - medium shadow (used on select dropdowns)
- **Large (lg)**: `shadow-lg` - large shadow (used on dialogs)

### Shadow Colors
- Default shadow uses black with low opacity

---

## TRANSITIONS & ANIMATIONS

### Transition Properties
- **All**: `transition-all` - transitions all properties (used on buttons)
- **Colors**: `transition-colors` - transitions color properties (used on table rows)
- **Color & Box Shadow**: `transition-[color,box-shadow]` - transitions color and shadow (used on inputs)
- **Transform**: `transition-transform` - transitions transform properties (used on switch thumb)

### Transition Duration
- **Default**: `duration-200` (200ms) - used on dialogs
- **Standard**: Uses default Tailwind duration (150ms typically)

### Animation Types
- **Fade In/Out**: `fade-in-0`, `fade-out-0`
- **Zoom In/Out**: `zoom-in-95`, `zoom-out-95` (scales to 95%)
- **Slide**: `slide-in-from-top-2`, `slide-in-from-bottom-2`, etc.

---

## ICONS

### Icon Library
- **Library**: Lucide React (`lucide-react`)
- **Default Size**: `size-4` (16px × 16px) for most icons
- **Small Icons**: `size-3` (12px × 12px) for badges
- **Large Icons**: `w-5 h-5` (20px × 20px) for navigation
- **Icon Behavior**: `pointer-events-none` - icons don't capture pointer events
- **Icon Shrink**: `shrink-0` - icons don't shrink in flex layouts

### Common Icons
- **Home**: `Home`
- **Settings**: `Settings`
- **Play**: `PlayCircle`
- **Chart**: `BarChart3`
- **Users**: `Users`
- **Network**: `Network`
- **Help**: `HelpCircle`
- **Trending**: `TrendingUp`
- **Plus**: `Plus`
- **Edit**: `Edit`
- **Upload**: `Upload`
- **Check**: `CheckIcon`
- **X/Close**: `XIcon`
- **Chevron Down**: `ChevronDownIcon`
- **Chevron Up**: `ChevronUpIcon`

---

## FOCUS STATES

### Focus Ring
- **Width**: `ring-[3px]` (3px) - **3 pixel focus ring**
- **Color**: Ring color at 50% opacity (`ring-ring/50`)
- **Offset**: `ring-offset-2` (8px) when specified
- **Border**: `focus-visible:border-ring` - border changes to ring color

### Focus Visibility
- **Property**: `focus-visible` - only shows on keyboard focus, not mouse click
- **Outline**: `outline-none` - removes default outline, replaced with ring

---

## DISABLED STATES

### Disabled Styling
- **Opacity**: `opacity-50` - 50% opacity
- **Cursor**: `cursor-not-allowed`
- **Pointer Events**: `pointer-events-none` - element doesn't respond to clicks

---

## RESPONSIVE DESIGN

### Breakpoints
- **Small (sm)**: `640px` (40rem)
- **Medium (md)**: `768px` (48rem)
- **Large (lg)**: `1024px` (64rem)

### Responsive Patterns
- **Dialog Width**: `max-w-[calc(100%-2rem)]` on mobile, `sm:max-w-lg` on desktop
- **Dialog Footer**: `flex-col-reverse` on mobile, `sm:flex-row sm:justify-end` on desktop
- **Dialog Header**: `text-center` on mobile, `sm:text-left` on desktop
- **Input Font**: `text-base` on desktop, `md:text-sm` on mobile
- **Grid Layouts**: `grid-cols-1` on mobile, `lg:grid-cols-3` on desktop

---

## ACCESSIBILITY

### ARIA Attributes
- **Invalid State**: `aria-invalid` - triggers error styling
- **Disabled State**: `disabled` attribute
- **Labels**: Proper label associations
- **Screen Reader**: `sr-only` class for screen-reader-only text

### Keyboard Navigation
- **Focus Visible**: Focus rings only appear on keyboard navigation
- **Tab Order**: Logical tab order throughout
- **Keyboard Shortcuts**: Standard browser shortcuts work

---

## COMPONENT-SPECIFIC DETAILS

### Toast Notifications
- **Animation**: `toast-enter` - fade in with slight scale and translate
- **Duration**: 200ms
- **Position**: Typically top-right or bottom-right

### Sheet/Drawer
- **Background**: Background color (white)
- **Border Radius**: Inherits from Sheet component
- **Animation**: Slide in from side

### Tabs
- **Active State**: Primary color background or underline
- **Inactive State**: Transparent or muted background
- **Border Radius**: Rounded on active tab

### Pagination
- **Button Style**: Similar to button variants
- **Active Page**: Primary color background
- **Spacing**: Consistent gap between page numbers

---

## DESIGN PRINCIPLES

1. **Consistency**: All similar elements use the same styling patterns
2. **Clarity**: Clear visual hierarchy with proper spacing and typography
3. **Accessibility**: High contrast, focus states, keyboard navigation
4. **Modern**: Clean, minimal design with subtle shadows and rounded corners
5. **Professional**: Business-appropriate color scheme and typography
6. **Responsive**: Works well on all screen sizes
7. **Semantic Colors**: Colors are defined by purpose, not specific values
8. **Rounded Corners**: **All interactive elements have rounded corners, not square** - buttons, inputs, cards, dialogs all use rounded-md (6px) or larger
9. **Smooth Transitions**: All state changes are animated smoothly
10. **Visual Feedback**: Hover, focus, and active states are clearly visible

---

## KEY VISUAL CHARACTERISTICS

- **Buttons are rounded (`rounded-md` = 6px), NOT square**
- **Cards have rounded corners (`rounded-xl` = 12px), NOT square**
- **Inputs are rounded (`rounded-md` = 6px), NOT square**
- **All interactive elements have rounded corners**
- **Focus rings are 3px wide**
- **Spacing is generous and consistent (4px base unit)**
- **Typography is clear and readable**
- **Colors are subtle and professional**
- **Shadows are minimal and subtle**
- **Transitions are smooth (150-200ms)**

---

## BRAND ELEMENTS

### Logo
- **Location**: Left sidebar, top section
- **Size**: `h-8` (32px height), auto width
- **Spacing**: `gap-3` (12px) between logo and text

### Brand Colors
- **Primary Brand**: Very dark blue/black (`#030213`)
- **Accent**: Blue (`#0052CC`) - used in some legacy elements
- **Text**: Very dark (`#1E1E1E`)

### Brand Name
- **Font**: System font, `text-[#0052CC]` (blue) in sidebar
- **Size**: Inherits from context

---

This design system ensures a cohesive, professional, and user-friendly interface throughout the Lira Compensation Simulator application.

