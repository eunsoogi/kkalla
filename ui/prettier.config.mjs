import prettierPluginSortImports from '@trivago/prettier-plugin-sort-imports'

export default {
  plugins: [prettierPluginSortImports],
  singleQuote: true,
  jsxSingleQuote: true,
  semi: true,
  useTabs: false,
  tabWidth: 2,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  trailingComma: 'all',
  importOrder: [
    '^react/(.*)$|^react$|^next/(.*)$|^next$',
    '<THIRD_PARTY_MODULES>',
    '^@/(.*)$',
    '^[./]'
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderGroupNamespaceSpecifiers: true,
}
