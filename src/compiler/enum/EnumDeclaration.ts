﻿import * as ts from "typescript";
import * as structures from "./../../structures";
import {getNamedNodeByNameOrFindFunction} from "./../../utils";
import {Node} from "./../common";
import {NamedNode, ExportableNode, ModifierableNode, AmbientableNode, DocumentationableNode} from "./../base";
import {EnumMember} from "./EnumMember";

export const EnumDeclarationBase = DocumentationableNode(AmbientableNode(ExportableNode(ModifierableNode(NamedNode(Node)))));
export class EnumDeclaration extends EnumDeclarationBase<ts.EnumDeclaration> {
    /**
     * Adds a member to the enum.
     * @param structure - Structure of the enum.
     */
    addMember(structure: structures.EnumMemberStructure) {
        const members = this.getMembers();
        const lastMember = members.length === 0 ? null : members[members.length - 1];
        const lastMemberEndsWithComma = lastMember != null && lastMember.endsWithComma();
        const indentationText = this.getChildIndentationText();
        const newLineChar = this.factory.getLanguageService().getNewLine();

        // create member text
        let memberText = "";
        if (lastMember != null && !lastMemberEndsWithComma)
            memberText += ",";
        memberText += `${newLineChar}${indentationText}${structure.name}`;

        // get the insert position
        let insertPos: number;
        if (lastMember == null)
            insertPos = this.getFirstChildByKind(ts.SyntaxKind.OpenBraceToken)!.getEnd();
        else if (lastMemberEndsWithComma)
            insertPos = lastMember.getFollowingComma()!.getEnd();
        else
            insertPos = lastMember.getEnd();

        // insert
        this.getRequiredSourceFile().insertText(insertPos, memberText);

        // get the member
        const newMembers = this.getMembers();
        const declaration = newMembers[newMembers.length - 1] as EnumMember;

        // add any other properties to it
        if (structure.value != null)
            declaration.setInitializer(structure.value.toString());

        return declaration;
    }

    /**
     * Gets an enum member.
     * @param name - Name of the member.
     * @param findFunction - Function to use to find the member.
     */
    getMember(name: string): EnumMember | undefined;
    getMember(findFunction: (declaration: EnumMember) => boolean): EnumMember | undefined;
    getMember(nameOrFindFunction: string | ((declaration: EnumMember) => boolean)): EnumMember | undefined {
        return getNamedNodeByNameOrFindFunction(this.getMembers(), nameOrFindFunction);
    }

    /**
     * Gets the enum's members.
     */
    getMembers() {
        return this.getMainChildren().filter(c => c instanceof EnumMember) as EnumMember[];
    }

    /**
     * Gets if it's a const enum.
     */
    hasConstKeyword() {
        return this.getConstKeyword() != null;
    }

    /**
     * Gets the const enum keyword or undefined if not exists.
     */
    getConstKeyword() {
        return this.getFirstModifierByKind(ts.SyntaxKind.ConstKeyword);
    }
}
