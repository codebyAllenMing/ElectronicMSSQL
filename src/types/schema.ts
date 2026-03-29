export type ConnectionInfo = {
  server: string
  port: number
}

export type TableInfo = {
  tableName: string
  columnCount: number
  rowCount: number
}

export type ColumnInfo = {
  columnName: string
  dataType: string
  maxLength: number | null
  isNullable: 'YES' | 'NO'
  defaultValue: string | null
  isPrimaryKey: boolean
  isForeignKey: boolean
  referencedTable: string | null
  referencedColumn: string | null
}
