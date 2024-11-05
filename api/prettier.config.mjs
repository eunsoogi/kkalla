import prettierPluginSortImports from '@trivago/prettier-plugin-sort-imports';

export default {
  plugins: [prettierPluginSortImports],
  singleQuote: true,
  semi: true,
  useTabs: false,
  tabWidth: 2,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  trailingComma: 'all',
  importOrder: ['^@nestjs/(.*)$', '<THIRD_PARTY_MODULES>', '^@/(.*)$', '^[./]'],
  importOrderParserPlugins: ['typescript', 'decorators-legacy'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderGroupNamespaceSpecifiers: true,
};
