﻿import * as compiler from "./../compiler";
import * as structures from "./../structures";

export function fillAbstractableNodeFromStructure(sourceFile: compiler.SourceFile, node: compiler.AbstractableNode, structure: structures.AbstractableStructure) {
    if (structure.isAbstract != null)
        node.setIsAbstract(structure.isAbstract, sourceFile);
}

export function fillAmbientableNodeFromStructure(sourceFile: compiler.SourceFile, node: compiler.AmbientableNode, structure: structures.AmbientableStructure) {
    if (structure.hasDeclareKeyword != null)
        node.toggleDeclareKeyword(structure.hasDeclareKeyword, sourceFile);
}

export function fillAsyncableNodeFromStructure(sourceFile: compiler.SourceFile, node: compiler.AsyncableNode, structure: structures.AsyncableStructure) {
    if (structure.isAsync != null)
        node.setIsAsync(structure.isAsync, sourceFile);
}

export function fillExportableNodeFromStructure(sourceFile: compiler.SourceFile, node: compiler.ExportableNode, structure: structures.ExportableStructure) {
    if (structure.isExported != null)
        node.setIsExported(structure.isExported, sourceFile);
    if (structure.isDefaultExport != null)
        node.setIsDefaultExport(structure.isDefaultExport, sourceFile);
}

export function fillGeneratorableNodeFromStructure(sourceFile: compiler.SourceFile, node: compiler.GeneratorableNode, structure: structures.GeneratorableStructure) {
    if (structure.isGenerator != null)
        node.setIsGenerator(structure.isGenerator, sourceFile);
}

export function fillInitializerExpressionableNodeFromStructure(
    sourceFile: compiler.SourceFile,
    node: compiler.InitializerExpressionableNode,
    structure: structures.InitializerExpressionableStructure
) {
    if (structure.initializer != null)
        node.setInitializer(structure.initializer, sourceFile);
}

export function fillQuestionTokenableNodeFromStructure(sourceFile: compiler.SourceFile, node: compiler.QuestionTokenableNode, structure: structures.QuestionTokenableStructure) {
    if (structure.isOptional != null)
        node.setIsOptional(structure.isOptional, sourceFile);
}

export function fillReadonlyableNodeFromStructure(sourceFile: compiler.SourceFile, node: compiler.ReadonlyableNode, structure: structures.ReadonlyableStructure) {
    if (structure.isReadonly != null)
        node.setIsReadonly(structure.isReadonly, sourceFile);
}

export function fillScopeableNodeFromStructure(sourceFile: compiler.SourceFile, node: compiler.ScopeableNode, structure: structures.ScopeableStructure) {
    if (structure.scope != null)
        node.setScope(structure.scope, sourceFile);
}

export function fillScopedNodeFromStructure(sourceFile: compiler.SourceFile, node: compiler.ScopedNode, structure: structures.ScopedStructure) {
    if (structure.scope != null)
        node.setScope(structure.scope, sourceFile);
}

export function fillStaticableNodeFromStructure(sourceFile: compiler.SourceFile, node: compiler.StaticableNode, structure: structures.StaticableStructure) {
    if (structure.isStatic != null)
        node.setIsStatic(structure.isStatic, sourceFile);
}

export function fillTypedNodeFromStructure(sourceFile: compiler.SourceFile, node: compiler.TypedNode, structure: structures.TypedStructure) {
    if (structure.type != null)
        node.setType(structure.type, sourceFile);
}