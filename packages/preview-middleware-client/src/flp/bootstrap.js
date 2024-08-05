/* eslint-disable @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-argument,
                  no-console */

/**
 * Calculates the script content for accessing the right sap/ushell/bootstrap sandbox.
 * @param fnCallback {Function} The callback function to be executed after the bootstrap is loaded.
 */
async function ushellBootstrap(fnCallback) {
    /*
    const currentPath = window?.location?.pathname.substring(0, window.location.pathname.lastIndexOf('/')) ?? '/';
    const numberOfStepsToRoot = currentPath.split('/').length - 2; // ignoring leading '/' and root entry
    const basePath = numberOfStepsToRoot > 0 ? '../'.repeat(numberOfStepsToRoot) : '/';

    let src = `${basePath}test-resources/sap/ushell/bootstrap/sandbox.js`;
    */
    let src = '/test-resources/sap/ushell/bootstrap/sandbox.js';
    try {
        //const response = await fetch(`${basePath}resources/sap-ui-version.json`);
        const response = await fetch(`/resources/sap-ui-version.json`);
        const json = await response.json();
        const version = json?.libraries?.find((lib) => lib.name === 'sap.ui.core')?.version;
        const major = version ? parseInt(version.split('.')[0], 10) : 2;
        if (major >= 2) {
            //src = `${basePath}resources/sap/ushell/bootstrap/sandbox2.js`;
            src = '/resources/sap/ushell/bootstrap/sandbox2.js';
        }
    } catch (error) {
        console.warn('Failed to fetch sap-ui-version.json. Assuming it is a 1.x version.');
    }

    // eslint-disable-next-line fiori-custom/sap-no-dom-access,fiori-custom/sap-browser-api-warning
    const shellBootstrap = document.getElementById('sap-ushell-bootstrap');
    if (shellBootstrap) {
        shellBootstrap.onload = () => {
            window['sap-ui-config']['xx-bootTask'](fnCallback);
        };
        shellBootstrap.setAttribute('src', src);
    }
}

// eslint-disable-next-line fiori-custom/sap-no-global-define
window['sap-ui-config'] = {
    'xx-bootTask': ushellBootstrap
};
