package com.example.todo.entity;

public enum TodoStatus {
    NOT_STARTED("未着手"),
    IN_PROGRESS("作業中"),
    DONE("完了");

    private final String label;

    TodoStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
