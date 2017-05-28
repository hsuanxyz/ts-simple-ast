﻿import * as ts from "typescript";
import * as errors from "./../../errors";
import {replaceNodeText} from "./../../manipulation";
import {CompilerFactory} from "./../../factories";
import {SourceFile} from "./../file";
import {InitializerExpressionableNode, ModifierableNode} from "./../base";
import {ConstructorDeclaration, MethodDeclaration} from "./../class";
import {FunctionDeclaration} from "./../function";
import {TypeAliasDeclaration} from "./../type";
import {InterfaceDeclaration} from "./../interface";
import {NamespaceDeclaration} from "./../namespace";
import {Symbol} from "./Symbol";

export class Node<NodeType extends ts.Node = ts.Node> {
    /** @internal */
    readonly factory: CompilerFactory;
    /** @internal */
    node: NodeType;

    /**
     * Initializes a new instance.
     * @internal
     * @param factory - Compiler factory.
     * @param node - Underlying node.
     */
    constructor(
        factory: CompilerFactory,
        node: NodeType
    ) {
        this.factory = factory;
        this.node = node;
    }

    /**
     * Gets the underlying compiler node.
     */
    getCompilerNode() {
        return this.node;
    }

    /**
     * Gets the syntax kind.
     */
    getKind() {
        return this.node.kind;
    }

    /**
     * Gets the syntax kind name.
     */
    getKindName() {
        return ts.SyntaxKind[this.node.kind];
    }

    /**
     * Gets the compiler symbol.
     */
    getSymbol(): Symbol | undefined {
        const boundSymbol = (this.node as any).symbol as ts.Symbol | undefined;
        if (boundSymbol != null)
            return this.factory.getSymbol(boundSymbol);

        const typeChecker = this.factory.getTypeChecker();
        const typeCheckerSymbol = typeChecker.getSymbolAtLocation(this);
        if (typeCheckerSymbol != null)
            return typeCheckerSymbol;

        const nameNode = (this.node as any).name as ts.Node | undefined;
        if (nameNode != null)
            return this.factory.getNodeFromCompilerNode(nameNode).getSymbol();

        return undefined;
    }

    /**
     * If the node contains the provided range (inclusive).
     * @param pos - Start position.
     * @param end - End position.
     */
    containsRange(pos: number, end: number) {
        return this.getPos() <= pos && end <= this.getEnd();
    }

    /**
     * Gets the first child by syntax kind or throws an error if not found.
     * @param kind - Syntax kind.
     * @param sourceFile - Optional source file to help with performance.
     */
    getFirstChildByKindOrThrow(kind: ts.SyntaxKind, sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        const firstChild = this.getFirstChildByKind(kind, sourceFile);
        if (firstChild == null)
            throw new errors.InvalidOperationError(`A child of the kind ${ts.SyntaxKind[kind]} was expected.`);
        return firstChild;
    }

    /**
     * Gets the first child by syntax kind.
     * @param kind - Syntax kind.
     * @param sourceFile - Optional source file to help with performance.
     */
    getFirstChildByKind(kind: ts.SyntaxKind, sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        return this.getFirstChild(child => child.getKind() === kind, sourceFile);
    }

    /**
     * Gets the first child by a condition.
     * @param condition - Condition.
     * @param sourceFile - Optional source file to help with performance.
     */
    getFirstChild(condition: (node: Node) => boolean, sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        for (const child of this.getChildren(sourceFile)) {
            if (condition(child))
                return child;
        }
        return undefined;
    }

    /**
     * Offset this node's positions (pos and end) and all of its children by the given offset.
     * @internal
     * @param offset - Offset.
     */
    offsetPositions(offset: number) {
        this.node.pos += offset;
        this.node.end += offset;

        for (const child of this.getChildren()) {
            child.offsetPositions(offset);
        }
    }

    getPreviousSibling() {
        let previousSibling: Node | undefined;

        for (const sibling of this.getSiblingsBefore()) {
            previousSibling = sibling;
        }

        return previousSibling;
    }

    getNextSibling() {
        const nextResult = this.getSiblingsAfter().next();
        return nextResult.done ? undefined : nextResult.value;
    }

    *getSiblingsBefore() {
        const parent = this.getParentSyntaxList() || this.getParentOrThrow();

        for (const child of parent.getChildrenIterator()) {
            if (child === this)
                return;

            yield child;
        }
    }

    *getSiblingsAfter() {
        // todo: optimize
        let foundChild = false;
        const parent = this.getParentSyntaxList() || this.getParentOrThrow();

        for (const child of parent.getChildrenIterator()) {
            if (!foundChild) {
                foundChild = child === this;
                continue;
            }

            yield child;
        }
    }

    getChildren(sourceFile = this.getSourceFileOrThrow()): Node[] {
        return this.node.getChildren(sourceFile.getCompilerNode()).map(n => this.factory.getNodeFromCompilerNode(n));
    }

    /**
     * @internal
     */
    *getChildrenIterator(sourceFile = this.getSourceFileOrThrow()): IterableIterator<Node> {
        for (const compilerChild of this.node.getChildren(sourceFile.getCompilerNode())) {
            yield this.factory.getNodeFromCompilerNode(compilerChild);
        }
    }

    // todo: make this a flags enum option for getChildren
    *getChildrenWithFlattenedSyntaxList(): IterableIterator<Node> {
        for (const compilerChild of this.node.getChildren()) {
            const child = this.factory.getNodeFromCompilerNode(compilerChild);

            // flatten out syntax list
            if (child.getKind() === ts.SyntaxKind.SyntaxList) {
                for (const syntaxChild of child.getChildrenWithFlattenedSyntaxList()) {
                    yield syntaxChild;
                }
            }
            else {
                yield child;
            }
        }
    }

    /**
     * Gets the child syntax list or throws if it doesn't exist.
     * @param sourceFile - Optional source file to help with performance.
     */
    getChildSyntaxListOrThrow(sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        const syntaxList = this.getChildSyntaxList(sourceFile);
        if (syntaxList == null)
            throw new errors.InvalidOperationError("A child syntax list was expected.");
        return syntaxList;
    }

    /**
     * Gets the child syntax list if it exists.
     * @param sourceFile - Optional source file to help with performance.
     */
    getChildSyntaxList(sourceFile: SourceFile = this.getSourceFileOrThrow()): Node | undefined {
        let node: Node = this;
        if (this.isFunctionDeclaration() || this.isNamespaceDeclaration())
            node = this.getBody();

        if (node.isSourceFile() || this.isFunctionDeclaration() || this.isNamespaceDeclaration())
            return node.getFirstChildByKind(ts.SyntaxKind.SyntaxList);

        let passedBrace = false;
        for (const child of node.getChildrenIterator()) {
            if (!passedBrace)
                passedBrace = child.getKind() === ts.SyntaxKind.FirstPunctuation;
            else if (child.getKind() === ts.SyntaxKind.SyntaxList)
                return child;
        }

        return undefined;
    }

    /**
     * Gets the children based on a kind.
     * @param kind - Syntax kind.
     * @param sourceFile - Optional source file to help with performance.
     */
    getChildrenOfKind<T extends Node = Node>(kind: ts.SyntaxKind, sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        return this.getChildren(sourceFile).filter(c => c.getKind() === kind) as T[];
    }

    *getAllChildren(sourceFile = this.getSourceFileOrThrow()): IterableIterator<Node> {
        for (const compilerChild of this.node.getChildren(sourceFile.getCompilerNode())) {
            const child = this.factory.getNodeFromCompilerNode(compilerChild);
            yield child;

            for (const childChild of child.getAllChildren(sourceFile))
                yield childChild;
        }
    }

    /**
     * Gets the child count.
     * @param sourceFile - Optional source file to help with performance.
     */
    getChildCount(sourceFile = this.getSourceFileOrThrow()) {
        return this.node.getChildCount(sourceFile.getCompilerNode());
    }

    /**
     * Gets the start position with leading trivia.
     */
    getPos() {
        return this.node.pos;
    }

    /**
     * Gets the end position.
     */
    getEnd() {
        return this.node.end;
    }

    /**
     * Gets the width of the node (length without trivia).
     */
    getWidth(sourceFile?: SourceFile) {
        return this.node.getWidth(Node.getCompilerSourceFile(sourceFile));
    }

    /**
     * Gets the full width of the node (length with trivia).
     */
    getFullWidth() {
        return this.node.getFullWidth();
    }

    /**
     * Gets the text without leading trivia.
     * @param sourceFile - Optional source file to help improve performance.
     */
    getText(sourceFile?: SourceFile) {
        return this.node.getText(Node.getCompilerSourceFile(sourceFile));
    }

    /**
     * Gets the full text with leading trivia.
     * @param sourceFile - Optional source file to help improve performance.
     */
    getFullText(sourceFile?: SourceFile) {
        return this.node.getFullText(Node.getCompilerSourceFile(sourceFile));
    }

    /**
     * Gets the combined modifier flags.
     */
    getCombinedModifierFlags() {
        return ts.getCombinedModifierFlags(this.node);
    }

    replaceCompilerNode(compilerNode: NodeType) {
        this.node = compilerNode;
    }

    /**
     * Gets the source file of a node or throws if it doesn't exist.
     */
    getSourceFileOrThrow() {
        const sourceFile = this.getSourceFile();
        if (sourceFile == null)
            throw new Error("A source file or source file parent was expected.");
        return sourceFile;
    }

    getSourceFile(): SourceFile | undefined {
        const topParent = this.getTopParent();
        return (topParent != null && topParent.isSourceFile() ? topParent : undefined) as SourceFile | undefined;
    }

    /**
     * Goes up the tree yielding all the parents in order.
     */
    *getParents() {
        let parent = (this as Node).getParent();
        while (parent != null) {
            yield parent;
            parent = parent!.getParent();
        }
    }

    getTopParent() {
        let currentParent = this as Node;
        for (const parent of this.getParents()) {
            currentParent = parent;
        }
        return currentParent;
    }

    getParent() {
        return (this.node.parent == null) ? undefined : this.factory.getNodeFromCompilerNode(this.node.parent);
    }

    /**
     * Gets the parent or throws an error if it doesn't exist.
     */
    getParentOrThrow() {
        const parentNode = this.getParent();
        if (parentNode == null)
            throw new Error("A parent is required to do this operation.");
        return parentNode;
    }

    appendNewLineSeparatorIfNecessary(sourceFile = this.getSourceFileOrThrow()) {
        const text = this.getFullText(sourceFile);
        if (this.isSourceFile()) {
            const hasText = text.length > 0;
            if (hasText)
                this.ensureLastChildNewLine();
        }
        else
            this.ensureLastChildNewLine();
    }

    ensureLastChildNewLine(sourceFile = this.getSourceFileOrThrow()) {
        if (!this.isLastChildTextNewLine(sourceFile))
            this.appendChildNewLine(sourceFile);
    }

    isLastChildTextNewLine(sourceFile = this.getSourceFileOrThrow()): boolean {
        const text = this.getFullText(sourceFile);
        /* istanbul ignore else */
        if (this.isSourceFile())
            return text.endsWith("\n");
        else if (this.isNamespaceDeclaration() || this.isFunctionDeclaration()) {
            const bodyText = this.getBody().getFullText(sourceFile);
            return /\n\s*\}$/.test(bodyText);
        }
        else
            throw this.getNotImplementedError();
    }

    appendChildNewLine(sourceFile?: SourceFile) {
        const newLineText = this.factory.getLanguageService().getNewLine();
        if (this.isSourceFile()) {
            sourceFile = this as SourceFile;
            sourceFile.node.text += newLineText;
            sourceFile.node.end += newLineText.length;
        }
        else {
            sourceFile = sourceFile || this.getSourceFileOrThrow();
            const indentationText = this.getIndentationText(sourceFile);
            const lastToken = this.getLastToken(sourceFile);
            const lastTokenPos = lastToken.getStart();
            replaceNodeText(sourceFile, lastTokenPos, lastTokenPos, newLineText + indentationText);
        }
    }

    /**
     * Gets the last token of this node. Usually this is a close brace.
     * @param sourceFile - Optional source file to help improve performance.
     */
    getLastToken(sourceFile = this.getSourceFileOrThrow()) {
        const lastToken = this.node.getLastToken(sourceFile.getCompilerNode());
        /* istanbul ignore if */
        if (lastToken == null)
            throw new errors.NotImplementedError("Not implemented scenario where the last token does not exist");

        return this.factory.getNodeFromCompilerNode(lastToken);
    }

    /**
     * Gets if this node is in a syntax list.
     */
    isInSyntaxList() {
        return this.getParentSyntaxList() != null;
    }

    /**
     * Gets the parent if it's a syntax list.
     */
    getParentSyntaxList() {
        const parent = this.getParent();
        if (parent == null)
            return undefined;

        const pos = this.getPos();
        const end = this.getEnd();
        for (const child of parent.getChildren()) {
            if (child.getPos() > pos || child === this)
                return undefined;

            if (child.getKind() === ts.SyntaxKind.SyntaxList && child.getPos() <= pos && child.getEnd() >= end)
                return child;
        }

        return undefined; // shouldn't happen
    }

    /**
     * Gets the child index of this node relative to the parent.
     */
    getChildIndex() {
        const parent = this.getParentSyntaxList() || this.getParent();
        if (parent == null)
            throw new errors.InvalidOperationError("Node must have a parent in order to get the child index.");
        let i = 0;
        for (const child of parent.getChildren()) {
            if (child === this)
                return i;
            i++;
        }

        /* istanbul ignore next */
        throw new errors.NotImplementedError("For some reason the child's parent did not contain the child.");
    }

    /**
     * Gets the parent if it's a syntax list or throws an error otherwise.
     */
    getParentSyntaxListOrThrow() {
        const parentSyntaxList = this.getParentSyntaxList();
        if (parentSyntaxList == null)
            throw new errors.InvalidOperationError("The parent must be a SyntaxList in order to get the required parent syntax list.");
        return parentSyntaxList;
    }

    /**
     * Gets if the current node is a source file.
     * @internal
     */
    isSourceFile(): this is SourceFile {
        return this.node.kind === ts.SyntaxKind.SourceFile;
    }

    /**
     * Gets if the current node is a constructor declaration.
     * @internal
     */
    isConstructorDeclaration(): this is ConstructorDeclaration {
        return this.node.kind === ts.SyntaxKind.Constructor;
    }

    /**
     * Gets if the current node is a function declaration.
     * @internal
     */
    isFunctionDeclaration(): this is FunctionDeclaration {
        return this.node.kind === ts.SyntaxKind.FunctionDeclaration;
    }

    /**
     * Gets if the current node is an interface declaration.
     * @internal
     */
    isInterfaceDeclaration(): this is InterfaceDeclaration {
        return this.node.kind === ts.SyntaxKind.InterfaceDeclaration;
    }

    /**
     * Gets if the current node is a namespace declaration.
     * @internal
     */
    isNamespaceDeclaration(): this is NamespaceDeclaration {
        return this.node.kind === ts.SyntaxKind.ModuleDeclaration;
    }

    /**
     * Gets if the current node is a type alias declaration.
     * @internal
     */
    isTypeAliasDeclaration(): this is TypeAliasDeclaration {
        return this.node.kind === ts.SyntaxKind.TypeAliasDeclaration;
    }

    /**
     * Gets if the current node is a modifierable node.
     * @internal
     */
    isModifierableNode(): this is ModifierableNode {
        return (this as any)[nameof<ModifierableNode>(n => n.addModifier)] != null;
    }

    /**
     * Gets if the current node is a method declaration.
     * @internal
     */
    isMethodDeclaration(): this is MethodDeclaration {
        return this.node.kind === ts.SyntaxKind.MethodDeclaration;
    }

    /**
     * Gets if the current node is an initializer expressionable node.
     * @internal
     */
    isInitializerExpressionableNode(): this is InitializerExpressionableNode {
        return (this as any)[nameof<InitializerExpressionableNode >(n => n.hasInitializer)] != null;
    }

    /**
     * Gets an error to throw when a feature is not implemented for this node.
     * @internal
     */
    getNotImplementedError() {
        return errors.getNotImplementedForSyntaxKindError(this.getKind());
    }

    /**
     * Gets the indentation text.
     * @param sourceFile - Optional source file to help improve performance.
     */
    getIndentationText(sourceFile = this.getSourceFileOrThrow()) {
        const sourceFileText = sourceFile.getFullText();
        const startLinePos = this.getStartLinePos(sourceFile);
        const startPos = this.getStart(sourceFile);
        let text = "";

        for (let i = startPos - 1; i >= startLinePos; i--) {
            const currentChar = sourceFileText[i];
            switch (currentChar) {
                case " ":
                case "\t":
                    text = currentChar + text;
                    break;
                case "\n":
                    return text;
                default:
                    text = "";
            }
        }

        return text;
    }

    /**
     * Gets the next indentation level text.
     * @param sourceFile - Optional source file to help improve performance.
     */
    getChildIndentationText(sourceFile = this.getSourceFileOrThrow()) {
        if (this.isSourceFile())
            return "";

        const oneIndentationLevelText = this.factory.getLanguageService().getOneIndentationLevelText();
        return this.getIndentationText(sourceFile) + oneIndentationLevelText;
    }

    /**
     * Gets the position of the start of the line that this node is on.
     * @param sourceFile - Optional source file to help improve performance.
     */
    getStartLinePos(sourceFile = this.getSourceFileOrThrow()) {
        const sourceFileText = sourceFile.getFullText();
        const startPos = this.getStart();

        for (let i = startPos - 1; i >= 0; i--) {
            const currentChar = sourceFileText.substr(i, 1);
            if (currentChar === "\n")
                return i + 1;
        }

        return 0;
    }

    /**
     * Gets the start without trivia.
     * @param sourceFile - Optional source file to help improve performance.
     */
    getStart(sourceFile = this.getSourceFileOrThrow()) {
        return this.node.getStart(sourceFile.getCompilerNode());
    }

    private static getCompilerSourceFile(sourceFile: SourceFile | undefined) {
        return sourceFile != null ? sourceFile.getCompilerNode() : undefined;
    }
}
