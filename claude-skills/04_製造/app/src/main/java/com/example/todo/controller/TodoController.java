package com.example.todo.controller;

import com.example.todo.entity.Todo;
import com.example.todo.entity.TodoStatus;
import com.example.todo.repository.TodoRepository;
import jakarta.validation.Valid;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@Controller
@RequestMapping("/todos")
public class TodoController {

    private final TodoRepository todoRepository;

    public TodoController(TodoRepository todoRepository) {
        this.todoRepository = todoRepository;
    }

    @GetMapping
    public String list(Model model) {
        List<Todo> todos = todoRepository.findAll();
        model.addAttribute("todos", todos);
        model.addAttribute("statuses", TodoStatus.values());
        if (!model.containsAttribute("newTodo")) {
            model.addAttribute("newTodo", new Todo());
        }
        return "todo/list";
    }

    @PostMapping
    public String create(@Valid @ModelAttribute("newTodo") Todo newTodo, BindingResult bindingResult, Model model) {
        if (bindingResult.hasErrors()) {
            model.addAttribute("todos", todoRepository.findAll());
            model.addAttribute("statuses", TodoStatus.values());
            return "todo/list";
        }
        todoRepository.save(newTodo);
        return "redirect:/todos";
    }

    @PostMapping("/{id}/status")
    public String updateStatus(@PathVariable Long id, @RequestParam TodoStatus status) {
        todoRepository.findById(id).ifPresent(todo -> {
            todo.setStatus(status);
            todoRepository.save(todo);
        });
        return "redirect:/todos";
    }

    @PostMapping("/{id}/delete")
    public String delete(@PathVariable Long id) {
        todoRepository.deleteById(id);
        return "redirect:/todos";
    }

    @GetMapping("/{id}/edit")
    public String editForm(@PathVariable Long id, Model model) {
        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Todo not found: " + id));
        model.addAttribute("todo", todo);
        model.addAttribute("statuses", TodoStatus.values());
        return "todo/edit";
    }

    @PostMapping("/{id}")
    public String update(@PathVariable Long id,
                          @Valid @ModelAttribute("todo") Todo form,
                          BindingResult bindingResult,
                          Model model) {
        if (bindingResult.hasErrors()) {
            form.setId(id);
            model.addAttribute("statuses", TodoStatus.values());
            return "todo/edit";
        }
        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Todo not found: " + id));
        todo.setTitle(form.getTitle());
        todo.setDescription(form.getDescription());
        todo.setDueDate(form.getDueDate());
        todo.setStatus(form.getStatus());
        todoRepository.save(todo);
        return "redirect:/todos";
    }
}
