/**
 * TekBooks application configuration — v1.0.9.
 *
 * This is the primary mobile source of truth for product identity, customer-facing
 * copy, theme colors, defaults, navigation labels, image presentation and lists.
 * It is source-code configuration only; customers never see a configuration page.
 *
 * IMPORTANT:
 * - Product defaults live here.
 * - A signed-in company's actual name/logo/TRN/contact details are stored in MongoDB
 *   and edited from Profile & company identity. Runtime company data always wins.
 */
export const APP_CONFIG = {
  name: 'TekBooks',
  version: '1.0.9',
  shortMark: 'TB',
  tagline: 'Clarity for every business decision',
  poweredBy: 'Powered by TekBooks',
  supportEmail: 'support@tekcorp.ae',

  /** Product-owned image files. Replace the files at these paths to rebrand the build. */
  assetFiles: {
    tekbooksLogo: '../assets/brand/tekbooks-logo.png',
    appIcon: '../assets/icon.png',
    adaptiveIcon: '../assets/adaptive-icon.png',
    splash: '../assets/splash.png',
    notificationIcon: '../assets/notification-icon.png',
  },

  /** Defaults used only when a workspace has not supplied its own values yet. */
  businessDefaults: {
    companyName: '',
    legalName: '',
    currency: 'AED',
    vatPercent: 5,
    businessEmail: '',
    phone: '',
    address: '',
    trn: '',
    invoiceDueDays: 30,
  },

  brand: {
    neutralWorkspaceName: 'Business Workspace',
    loginFallbackText: 'Business book keeping, invoices and reporting in one secure workspace.',
    loginCompanyText: 'Secure access to your private business workspace.',
    documentAttribution: 'Powered by TekBooks',
  },

  security: {
    /**
     * Expo Go is development-only, but its installation identity is stable enough
     * to retain a local development session across Metro reloads. Production API
     * policy still rejects Expo Go sign-in, so this does not weaken release builds.
     */
    persistExpoGoSession: true,
  },

  layout: {
    phoneContentMaxWidth: 760,
    compactPhoneWidth: 360,
    compactHorizontalPadding: 14,
    regularHorizontalPadding: 20,
    largeHorizontalPadding: 28,
    tabBarBaseHeight: 58,
  },

  typography: {
    preferredFamily: 'Lufga',
    // Add licensed files at mobile/assets/fonts/Lufga-Regular.ttf and
    // mobile/assets/fonts/Lufga-Medium.ttf. Native APK/AAB builds embed them.
    regularFamily: undefined as string | undefined,
    mediumFamily: undefined as string | undefined,
    regularWeight: '400' as const,
    mediumWeight: '500' as const,
    semiboldWeight: '500' as const,
  },

  theme: {
    light: {
      primary: '#10C8A9', primary2: '#0DB89C', accent: '#2DEBCA', accentSoft: 'rgba(16,200,169,0.11)',
      background: '#F9FFFE', backgroundAlt: '#F1FBF9', surface: 'rgba(249,255,254,0.76)', surfaceStrong: '#FFFFFF', surfaceMuted: '#F2FBF9',
      text: '#000E11', textMuted: '#52696C', textSoft: '#8AA0A2', border: 'rgba(0,14,17,0.08)', borderStrong: 'rgba(16,200,169,0.20)',
      shadow: '#063D37', success: '#0F9F7F', successSoft: 'rgba(16,200,169,0.10)', warning: '#B97810', warningSoft: '#FFF7E9', danger: '#C63C4B', dangerSoft: '#FFF0F2', info: '#246BCE', infoSoft: '#EEF5FF',
      tab: 'rgba(249,255,254,0.98)', overlay: 'rgba(0,14,17,0.38)', onPrimary: '#FFFFFF', glow: 'rgba(45,235,202,0.18)', gradientMid: '#F7FFFD', modalShadow: '#000000',
      heroText: '#F9FFFE', heroTextMuted: '#D7FFF8', heroGlass: 'rgba(255,255,255,0.10)', heroGlassBorder: 'rgba(255,255,255,0.15)',
    },
    dark: {
      primary: '#2DEBCA', primary2: '#10C8A9', accent: '#2DEBCA', accentSoft: 'rgba(45,235,202,0.12)',
      background: '#000E11', backgroundAlt: '#03171A', surface: 'rgba(5,28,31,0.78)', surfaceStrong: '#061C1F', surfaceMuted: '#041619',
      text: '#F9FFFE', textMuted: '#A9C0C0', textSoft: '#6E888A', border: 'rgba(45,235,202,0.11)', borderStrong: 'rgba(45,235,202,0.24)',
      shadow: '#000000', success: '#58F0D0', successSoft: 'rgba(45,235,202,0.11)', warning: '#F1C56E', warningSoft: '#2B2414', danger: '#FF9EA8', dangerSoft: '#311519', info: '#8EBBFF', infoSoft: '#10243A',
      tab: 'rgba(0,14,17,0.98)', overlay: 'rgba(0,0,0,0.68)', onPrimary: '#000E11', glow: 'rgba(45,235,202,0.13)', gradientMid: '#001519', modalShadow: '#000000',
      heroText: '#F9FFFE', heroTextMuted: '#D7FFF8', heroGlass: 'rgba(255,255,255,0.10)', heroGlassBorder: 'rgba(255,255,255,0.15)',
    },
  },

  assets: {
    logo: { fit: 'contain' as const, backgroundPadding: 10, loginSize: 116, loginRadius: 28, compactSize: 54, profilePreviewHeight: 124 },
    productLogo: { loginWidth: 250, loginHeight: 82, companyLoginWidth: 240, companyLoginHeight: 104, workspaceWidth: 190, workspaceHeight: 52 },
    avatar: { fit: 'cover' as const, profileSize: 82, compactSize: 44, radiusRatio: 0.34 },
    upload: {
      acceptedImages: ['image/jpeg','image/png','image/webp'],
      preferredLogoTypes: ['image/png','image/jpeg','image/jpg'],
      logoHint: 'PNG or JPEG • landscape, square and transparent logos are supported',
      profileHint: 'JPG, PNG or WebP • square photos look best',
    },
  },

  navigation: {
    overview: 'Overview', money: 'Money', invoices: 'Invoices', contacts: 'Contacts', workspace: 'Workspace',
  },

  copy: {
    loginEyebrow: 'BUSINESS BOOK KEEPING',
    loginTitle: 'Your books. Your business. Beautifully clear.',
    loginBody: 'Income, expenses, invoices, VAT, documents and receivables—organized in one private workspace.',
    loginPowered: 'Secure book keeping, powered by TekBooks',
    loginSignInTitle: 'Welcome back',
    loginSignInSubtitle: 'Sign in to continue to your private business workspace.',
    loginEmailLabel: 'Business email', loginPasswordLabel: 'Password', loginButton: 'Continue securely', loginForgot: 'Forgot password?',
    loginCreatePrompt: 'New business workspace?', loginCreateAction: 'Create account', loginSecurity: 'Private business access • Protected device sign-in',
    dashboardTitle: 'Business overview', dashboardPosition: 'Available business position',
    transactionsTitle: 'Money in & out', transactionsSubtitle: 'A clean, searchable record of every business movement',
    invoicesTitle: 'Invoices & receivables', invoicesSubtitle: 'Create polished invoices, collect payments and see exactly what remains due',
    contactsTitle: 'Customers & suppliers', contactsSubtitle: 'Business relationships and account activity in one place',
    reportsTitle: 'Reports & statements', reportsSubtitle: 'Clear management reports for confident business decisions',
    profileTitle: 'Profile & company identity', profileSubtitle: 'Personal profile and the company identity customers see on documents',
    profilePersonalTitle: 'Your profile', profilePersonalSubtitle: 'Shown inside your private workspace',
    companyIdentityTitle: 'Company identity', companyIdentitySubtitle: 'Used on login, invoices, reports and exported statements',
    profileSavedTitle: 'Profile saved', profileSavedBody: 'Your profile photo and company identity are now used throughout TekBooks.',
    moreTitle: 'Workspace', moreSubtitle: 'Profile, reports, appearance and secure account access',
    appearanceTitle: 'Appearance', darkThemeTitle: 'Dark theme', darkThemeSubtitle: 'Switch between Tek White and Tek Navy themes',
    businessWorkspaceTitle: 'Business workspace', securityTitle: 'Security',
    reportsMenuTitle: 'Reports & statements', reportsMenuSubtitle: 'Choose sections and export professional PDF or Excel reports',
    profileMenuTitle: 'Profile & company identity', profileMenuSubtitle: 'Profile photo, company logo, TRN, VAT and document branding',
    deviceRequestsTitle: 'Device approval requests', deviceRequestsSubtitle: 'Approve a sign-in request from a replacement phone',
    signOut: 'Sign out',
    workspaceOwner: 'Workspace owner', companyProfileIncomplete: 'Company profile not completed',
    noCustomersTitle: 'No customers yet', noCustomersBody: 'Add your first customer here. The customer will be saved and selected without leaving the invoice.',
    logoPreviewUnavailableTitle: 'Logo preview unavailable', logoPreviewUnavailableBody: 'The saved logo could not be loaded. Re-upload a PNG or JPEG; its aspect ratio will be preserved on login, invoices and reports.',
  },

  labels: {
    optional: 'Optional', required: 'Required', companyLogo: 'Company logo', profilePhoto: 'Profile photo', companyName: 'Company name',
    legalName: 'Legal name', email: 'Email', phone: 'Phone', address: 'Address', trn: 'TRN', currency: 'Currency', vat: 'VAT %',
  },
} as const;

/** Local product artwork. Replace the PNG file to update the in-app TekBooks logo. */
export const APP_ASSETS = {
  tekbooksLogo: require('../assets/brand/tekbooks-logo.png'),
  tekbooksLogoDark: require('../assets/brand/tekbooks-logo-dark.png'),
  appIcon: require('../assets/icon.png'),
};

export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Card', 'Cheque', 'Online Payment', 'Other'] as const;
export const TRANSACTION_CATEGORIES = {
  INCOME: ['Sales', 'Services', 'Commission', 'Rental Income', 'Other Income'],
  EXPENSE: ['General', 'Fuel', 'Rent', 'Utilities', 'Salary', 'Office', 'Marketing', 'Travel', 'Supplier', 'Professional Fees', 'Other Expense'],
} as const;
export const VAT_TREATMENTS = [
  { key: 'TAXABLE', label: 'Taxable' }, { key: 'ZERO_RATED', label: 'Zero-rated' }, { key: 'EXEMPT', label: 'Exempt' },
] as const;
export const REPORT_SECTIONS = [
  {key:'summary',label:'Executive Summary',description:'Income, expenses, profit, receivables and VAT position'},
  {key:'profit-loss',label:'Profit & Loss',description:'Income and expense categories with net result'},
  {key:'income',label:'Income Report',description:'Income ledger with payment and customer details'},
  {key:'expenses',label:'Expense Report',description:'Expense ledger with payment and VAT details'},
  {key:'receivables',label:'Outstanding Receivables',description:'Open and overdue customer invoices'},
  {key:'customers',label:'Customer Statements',description:'Billed, paid and outstanding balances by customer'},
  {key:'suppliers',label:'Supplier Statements',description:'Recorded supplier business and activity'},
  {key:'vat',label:'VAT Summary',description:'Output VAT, input VAT and payable or recoverable position'},
] as const;
