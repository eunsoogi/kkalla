import prettierPluginSortImports from '@trivago/prettier-plugin-sort-imports'

export default {
  plugins: [prettierPluginSortImports],
  singleQuote: true,
  jsxSingleQuote: true,
  semi: false,
  useTabs: false,
  tabWidth: 2,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  trailingComma: 'none',
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
