// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build --env=prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.

export const environment = {
  production: false,
  logLevel: 'debug',
  idleTimeoutMinutes: 30, // Idle timeout in minutes
  idleWarningMinutes: 2,  // Warning time before logout

  // Configurable UI copy
  welcomeLoginPrompt: 'Welcome to ISRA LMS. Please log in or register to get started!',
  welcomeShort: 'Welcome to ISRA LMS',
  aboutMessage: 'About ISRA LMS',
  aboutText: `Sadaqah Jariyah for my mother and my father and 
              all mothers and fathers who are no longer with us 
              who instilled beneficial knowledge in their children.`
};
