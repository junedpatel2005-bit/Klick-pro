# CKEditor 5 - Common Integration Utils

[![npm version](https://badge.fury.io/js/%40ckeditor%2Fckeditor5-integrations-common.svg)](https://www.npmjs.com/package/@ckeditor/ckeditor5-integrations-common)
[![CircleCI](https://circleci.com/gh/ckeditor/ckeditor5-integrations-common.svg?style=shield)](https://app.circleci.com/pipelines/github/ckeditor/ckeditor5-integrations-common?branch=master)
[![Coverage Status](https://codecov.io/github/ckeditor/ckeditor5-integrations-common/graph/badge.svg)](https://codecov.io/github/ckeditor/ckeditor5-integrations-common)
![Dependency Status](https://img.shields.io/librariesio/release/npm/@ckeditor/ckeditor5-integrations-common)

Official [CKEditor 5](https://ckeditor.com/ckeditor-5/) common integration utils. This package contains a set of utilities that are shared between CKEditor 5 framework integrations such like:

- [CKEditor 5 Vue integration](https://github.com/ckeditor/ckeditor5-vue)
- [CKEditor 5 React integration](https://github.com/ckeditor/ckeditor5-react)
- [CKEditor 5 Angular integration](https://github.com/ckeditor/ckeditor5-angular)

The prime example of such shared utility might be the CKEditor 5 Cloud integration loader that is used by all integrations to dynamically load the editor from the CDN.

It's highly recommended to not use this package directly in your application because it's intended to be used by through the integrations listed above. However, if you need to use it directly (because you are using framework that is not supported by the integrations), you can use it as a standalone package, but keep in mind that the API is designed to be used by the integrations and might not be user-friendly.

## Contributing

After cloning this repository, install the necessary dependencies:

> [!NOTE]
> This project requires **pnpm v10** or higher. You can check your version with `pnpm --version` and update if needed with `npm install -g pnpm@latest`.

```bash
pnpm install
```

### Running the development server

You can start the development server using the command below:

```bash
pnpm run dev
```

### Executing tests

To test the editor integration against a set of automated tests, run the following command:

```bash
pnpm run test
```

If you want to run the tests in watch mode, use the following command:

```bash
pnpm run test:watch
```

### Building the package

To build the package that is ready to publish, use the following command:

```bash
pnpm run build
```

## License

Licensed under a dual-license model, this software is available under:

* the [GNU General Public License Version 2 or later](http://www.gnu.org/licenses/gpl.html),
* or commercial license terms from CKSource Holding sp. z o.o.

For more information, see: [https://ckeditor.com/legal/ckeditor-licensing-options](https://ckeditor.com/legal/ckeditor-licensing-options).
