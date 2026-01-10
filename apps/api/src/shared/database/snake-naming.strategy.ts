import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';
import { snakeCase } from 'typeorm/util/StringUtils';

/**
 * Custom naming strategy that keeps existing camelCase table/column names
 * (so we stay compatible with the current schema), but forces join-table
 * identifiers to snake_case so TypeORM doesn't generate invalid names such as
 * `User_User__User_roles`.
 */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(className: string, customName?: string): string {
    return customName ?? className;
  }

  columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    const prefix = embeddedPrefixes ? embeddedPrefixes.join('') : '';
    return prefix + (customName || propertyName);
  }

  relationName(propertyName: string): string {
    return propertyName;
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return `${relationName}${referencedColumnName.charAt(0).toUpperCase()}${referencedColumnName.slice(
      1,
    )}`;
  }

  classTableInheritanceParentColumnName(
    parentTableName: string,
    parentTableIdPropertyName: string,
  ): string {
    return `${parentTableName}${parentTableIdPropertyName.charAt(0).toUpperCase()}${parentTableIdPropertyName.slice(
      1,
    )}`;
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    _secondPropertyName: string,
  ): string {
    return snakeCase(
      `${firstTableName}_${firstPropertyName.replace(/\./g, '_')}_${secondTableName}`,
    );
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snakeCase(`${tableName}_${columnName ?? propertyName}`);
  }
}
