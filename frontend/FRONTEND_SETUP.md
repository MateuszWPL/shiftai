# Frontend Setup - Employees Page

## 📁 Files Created

### 1. API Client (`lib/api.ts`)
- Generic API client helper
- Points to `http://127.0.0.1:8000/api/v1`
- Type-safe API methods (GET, POST, PUT, DELETE)
- Error handling with custom `ApiClientError`
- Type definitions for `Employee` and `Organization`

### 2. UI Components
- **`components/ui/table.tsx`** - Shadcn UI Table component
- **`components/ui/button.tsx`** - Shadcn UI Button component
- **`lib/utils.ts`** - Utility function for className merging

### 3. Employees Page (`app/dashboard/employees/page.tsx`)
- Client component with `"use client"` directive
- Fetches employees for Organization ID 1 (hardcoded for MVP)
- Loading state with skeleton
- Error handling
- Professional table layout with Tailwind CSS

## 🚀 Installation

Install required dependencies:

```bash
cd frontend
npm install
```

This will install:
- `clsx` - for conditional className
- `tailwind-merge` - for merging Tailwind classes

## 🎯 Usage

### Start the Frontend

```bash
cd frontend
npm run dev
```

The page will be available at:
```
http://localhost:3000/dashboard/employees
```

### Prerequisites

1. **Backend must be running** on `http://127.0.0.1:8000`
2. **Organization must exist** - Create an organization first using:
   ```
   POST http://127.0.0.1:8000/api/v1/organizations/
   {
     "name": "My Organization",
     "plan": "free"
   }
   ```
3. **Employees must exist** - Create employees for organization ID 1

## 📋 Features

### Employees Page
- ✅ Fetches employees from API
- ✅ Loading skeleton while fetching
- ✅ Error display if API fails
- ✅ Empty state message
- ✅ Professional table layout
- ✅ Formatted currency (PLN)
- ✅ Responsive design
- ✅ Dark mode support

### Table Columns
1. **Name** - First name + Last name
2. **Role** - Employee role
3. **Hourly Rate** - Formatted as currency
4. **Actions** - View button (placeholder)

## 🎨 Styling

- Uses Tailwind CSS for all styling
- Professional spacing and padding
- Clean headers and borders
- Hover effects on table rows
- Responsive container with proper padding
- Dark mode support via CSS variables

## 🔧 Configuration

### API Base URL
To change the API URL, edit `lib/api.ts`:
```typescript
const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';
```

### Organization ID
Currently hardcoded to `1` in `app/dashboard/employees/page.tsx`:
```typescript
const ORGANIZATION_ID = 1;
```

## 🐛 Troubleshooting

### CORS Error
If you see CORS errors, make sure:
1. Backend CORS is configured to allow `http://localhost:3000`
2. Backend is running on `http://127.0.0.1:8000`

### No Employees Showing
1. Check if organization ID 1 exists
2. Check if employees exist for that organization
3. Check browser console for errors
4. Verify backend is running

### Styling Issues
1. Make sure Tailwind CSS is properly configured
2. Check if `globals.css` is imported in `layout.tsx`
3. Verify all CSS variables are defined

## 📝 Next Steps

- [ ] Add form to create new employees
- [ ] Add edit/delete functionality
- [ ] Add filtering and search
- [ ] Add pagination
- [ ] Connect "Add Employee" button to form
- [ ] Add employee detail view

