import { action, makeObservable, observable, toJS, runInAction } from 'mobx'
import {
  each,
  FormPath,
  FormPathPattern,
  isFn,
  isRegExp,
  isValid,
  map,
  uid,
  globalThisPolyfill
} from '@formily/shared'
import { Heart } from './Heart'
import { Field } from './Field'
import {
  JSXComponent,
  LifeCycleTypes,
  HeartSubscriber,
  FormPatternTypes,
  FormRequests,
  IFormGraph,
  ICreateFieldProps,
  IFieldState,
  IFormState,
  IFormProps,
  IFieldResetOptions
} from '../types'
import { ignoreVoidPath } from '../shared'
import { getLifecyclesFromEffects } from '../effect'
import { Feedback } from './Feedback'
import { ArrayField } from './ArrayField'
import { ObjectField } from './ObjectField'
import { VoidField } from './VoidField'

const DEV_TOOLS_HOOK = '__FORMILY_DEV_TOOLS_HOOK__'

export class Form {
  id: string
  initialized: boolean
  validating: boolean
  submitting: boolean
  modified: boolean
  pattern: FormPatternTypes
  values: any
  initialValues: any
  mounted: boolean
  unmounted: boolean
  props: IFormProps
  heart: Heart
  feedback: Feedback
  fields: Record<string, Field> = {}
  requests: FormRequests = {}
  displayName = 'Form'
  constructor(props: IFormProps) {
    this.initialize(props)
    this.makeObservable()
    this.makeSubscrible()
  }

  protected initialize(props: IFormProps) {
    this.id = uid()
    this.feedback = new Feedback()
    this.props = { ...Form.defaultProps, ...props }
    this.initialized = false
    this.submitting = false
    this.validating = false
    this.modified = false
    this.mounted = false
    this.unmounted = false
    this.pattern = this.props.pattern
    this.values = this.props.values || {}
    this.initialValues = this.props.initialValues || {}
  }

  protected makeObservable() {
    makeObservable(this, {
      fields: observable,
      initialized: observable,
      validating: observable,
      submitting: observable,
      modified: observable,
      pattern: observable,
      values: observable,
      initialValues: observable,
      mounted: observable,
      unmounted: observable,
      setValues: action,
      setValuesIn: action,
      setInitialValues: action,
      setInitialValuesIn: action,
      setPattern: action,
      deleteIntialValuesIn: action,
      deleteValuesIn: action,
      setSubmitting: action,
      setValidating: action,
      setFormGraph: action,
      createField: action,
      createArrayField: action,
      createObjectField: action,
      createVoidField: action
    })
  }

  protected makeSubscrible() {
    this.heart = new Heart({
      lifecycles: this.lifecycles,
      context: this
    })
    this.onInit()
  }

  get valid() {
    return this.feedback.valid
  }

  get invalid() {
    return this.feedback.invalid
  }

  get errors() {
    return this.feedback.errors
  }

  get warnings() {
    return this.feedback.warnings
  }

  get successes() {
    return this.feedback.successes
  }

  get lifecycles() {
    return getLifecyclesFromEffects(this.props.effects, this)
  }

  /** 创建字段 **/

  createField = <
    Decorator extends JSXComponent,
    Component extends JSXComponent
  >(
    props: ICreateFieldProps<Decorator, Component>
  ) => {
    const path = FormPath.parse(props.basePath).concat(props.name)
    const identifier = path.toString()
    if (!this.fields[identifier]) {
      this.fields[identifier] = new Field(path, props, this)
      this.fields[identifier].onInit()
    }
    this.fields[identifier].path = path
    this.fields[identifier].form = this
    return this.fields[identifier]
  }

  createVoidField = <
    Decorator extends JSXComponent,
    Component extends JSXComponent
  >(
    props: ICreateFieldProps<Decorator, Component>
  ) => {
    const path = FormPath.parse(props.basePath).concat(props.name)
    const identifier = path.toString()
    if (!this.fields[identifier]) {
      this.fields[identifier] = new VoidField(path, props, this)
      this.fields[identifier].onInit()
    }
    this.fields[identifier].path = path
    this.fields[identifier].form = this
    return this.fields[identifier]
  }

  createArrayField = <
    Decorator extends JSXComponent,
    Component extends JSXComponent
  >(
    props: ICreateFieldProps<Decorator, Component>
  ) => {
    const path = FormPath.parse(props.basePath).concat(props.name)
    const identifier = path.toString()
    if (!this.fields[identifier]) {
      this.fields[identifier] = new ArrayField(path, props, this)
      this.fields[identifier].onInit()
    }
    this.fields[identifier].path = path
    this.fields[identifier].form = this
    return this.fields[identifier]
  }

  createObjectField = <
    Decorator extends JSXComponent,
    Component extends JSXComponent
  >(
    props: ICreateFieldProps<Decorator, Component>
  ) => {
    const path = FormPath.parse(props.basePath).concat(props.name)
    const identifier = path.toString()
    if (!this.fields[identifier]) {
      this.fields[identifier] = new ObjectField(path, props, this)
      this.fields[identifier].onInit()
    }
    this.fields[identifier].path = path
    this.fields[identifier].form = this
    return this.fields[identifier]
  }

  /** 状态操作模型 **/

  setValues = (values: any) => {
    this.modified = true
    this.values = values
    this.notify(LifeCycleTypes.ON_FORM_VALUES_CHANGE)
  }

  setValuesIn = (pattern: FormPathPattern, value: any) => {
    FormPath.setIn(this.values, ignoreVoidPath(pattern, this), value)
  }

  deleteValuesIn = (pattern: FormPathPattern) => {
    FormPath.deleteIn(this.values, ignoreVoidPath(pattern, this))
  }

  existValuesIn = (pattern: FormPathPattern) => {
    return FormPath.existIn(this.values, ignoreVoidPath(pattern, this))
  }

  getValuesIn = (pattern: FormPathPattern) => {
    return FormPath.getIn(this.values, ignoreVoidPath(pattern, this))
  }

  setInitialValues = (initialValues: any) => {
    this.initialValues = initialValues
    this.notify(LifeCycleTypes.ON_FORM_INITIAL_VALUES_CHANGE)
  }

  setInitialValuesIn = (pattern: FormPathPattern, initialValue: any) => {
    FormPath.setIn(
      this.initialValues,
      ignoreVoidPath(pattern, this),
      initialValue
    )
  }

  deleteIntialValuesIn = (pattern: FormPathPattern) => {
    FormPath.deleteIn(this.initialValues, ignoreVoidPath(pattern, this))
  }

  existInitialValuesIn = (pattern: FormPathPattern) => {
    return FormPath.existIn(
      this.initialValues,
      ignoreVoidPath(pattern, this)
    )
  }

  getInitialValuesIn = (pattern: FormPathPattern) => {
    return FormPath.getIn(
      this.initialValues,
      ignoreVoidPath(pattern, this)
    )
  }

  setSubmitting = (submitting: boolean) => {
    if (submitting) {
      this.notify(LifeCycleTypes.ON_FORM_SUBMIT_START)
    }
    this.submitting = submitting
    if (!submitting) {
      this.notify(LifeCycleTypes.ON_FORM_SUBMIT_END)
    }
  }

  setValidating = (validating: boolean) => {
    clearTimeout(this.requests.validate)
    if (validating) {
      this.requests.validate = setTimeout(() => {
        runInAction(() => {
          this.validating = validating
          this.notify(LifeCycleTypes.ON_FORM_VALIDATE_START)
        })
      }, 100)
    } else if (this.validating !== validating) {
      this.validating = validating
      this.notify(LifeCycleTypes.ON_FORM_VALIDATE_END)
    }
  }

  setPattern = (pattern: FormPatternTypes) => {
    this.pattern = pattern
  }

  addEffects = (id: string, effects: IFormProps['effects']) => {
    this.heart.addLifeCycles(id, getLifecyclesFromEffects(effects))
  }

  removeEffects = (id: string) => {
    this.heart.removeLifeCycles(id)
  }

  setEffects = (effects: IFormProps['effects']) => {
    this.heart.setLifeCycles(getLifecyclesFromEffects(effects))
  }

  query = (
    pattern: FormPathPattern | RegExp,
    filter?: (field: Field, path: string) => boolean | void
  ): Field => {
    for (let identifier in this.fields) {
      const field = this.fields[identifier]
      if (isRegExp(pattern)) {
        if (pattern.test(field.path.toString())) {
          if (isFn(filter)) {
            if (filter(field, identifier) === true) return field
          } else {
            return field
          }
        }
      } else {
        if (FormPath.parse(pattern).match(field.path)) {
          if (isFn(filter)) {
            if (filter(field, identifier) === true) return field
          } else {
            return field
          }
        }
      }
    }
  }

  queryAll = (
    pattern: FormPathPattern | RegExp,
    filter?: (field: Field, path: string) => boolean | void
  ): Field[] => {
    const results = []
    for (let identifier in this.fields) {
      const field = this.fields[identifier]
      if (isRegExp(pattern)) {
        if (pattern.test(field.path.toString())) {
          if (isFn(filter)) {
            if (filter(field, identifier) === true) {
              results.push(field)
              break
            }
          } else {
            results.push(field)
          }
        }
      } else {
        if (FormPath.parse(pattern).match(field.path)) {
          if (isFn(filter)) {
            if (filter(field, identifier) === true) {
              results.push(field)
              break
            }
          } else {
            results.push(field)
          }
        }
      }
    }
    return results
  }

  notify = (type: LifeCycleTypes, payload?: any) => {
    this.heart.publish(type, isValid(payload) ? payload : this)
  }

  subscribe = (subscriber?: HeartSubscriber) => {
    return this.heart.subscribe(subscriber)
  }

  unsubscribe = (id: number) => {
    this.heart.unsubscribe(id)
  }

  /**事件钩子**/

  onInit = () => {
    this.initialized = true
    this.notify(LifeCycleTypes.ON_FORM_INIT)
  }

  onMount = () => {
    this.mounted = true
    this.notify(LifeCycleTypes.ON_FORM_MOUNT)
    if (globalThisPolyfill[DEV_TOOLS_HOOK]) {
      globalThisPolyfill[DEV_TOOLS_HOOK].inject(this.id, this)
    }
  }

  onUnmount = () => {
    this.unmounted = true
    this.notify(LifeCycleTypes.ON_FORM_UNMOUNT)
    this.heart.clear()
    if (globalThisPolyfill[DEV_TOOLS_HOOK]) {
      globalThisPolyfill[DEV_TOOLS_HOOK].unmount(this.id)
    }
  }

  /**节点模型**/

  toJSON = (): IFormState => {
    return {
      displayName: this.displayName,
      id: this.id,
      validating: this.validating,
      values: toJS(this.values),
      initialValues: toJS(this.initialValues),
      submitting: this.submitting,
      valid: this.valid,
      invalid: this.invalid,
      initialized: this.initialized,
      mounted: this.mounted,
      unmounted: this.unmounted,
      modified: this.modified,
      errors: toJS(this.errors),
      warnings: toJS(this.warnings),
      successes: toJS(this.successes),
      pattern: this.pattern
    }
  }

  fromJSON = (state: IFormState) => {}

  getFormGraph = (): IFormGraph => {
    const graph = Object.assign(
      map(this.fields, field => {
        return field.toJSON()
      }),
      {
        '': this.toJSON()
      }
    )
    return graph
  }

  setFormGraph = (graph: IFormGraph) => {
    each(graph, (state, path) => {
      if (Form.isFieldState(state)) {
        if (this.fields[path]) {
          this.fields[path].fromJSON(state)
        } else {
          this.fields[path] = new Field(FormPath.parse(path), {}, this)
          this.fields[path].fromJSON(state)
          this.fields[path].onInit()
        }
      } else if (Form.isFormState(state)) {
        this.fromJSON(state)
      }
    })
  }

  validate = async (pattern: FormPathPattern | RegExp = '*') => {
    this.setValidating(true)
    this.notify(LifeCycleTypes.ON_FORM_VALIDATE_START)
    const tasks = []
    this.query(pattern, field => {
      tasks.push(field.validate())
    })
    await Promise.all(tasks)
    this.setValidating(false)
    this.notify(LifeCycleTypes.ON_FORM_VALIDATE_END)
    if (this.feedback.invalid) {
      throw this.feedback.errors
    }
  }

  submit = async (onSubmit?: (values: any) => Promise<any> | void) => {
    this.setSubmitting(true)
    this.feedback.clear({
      code: 'SubmitError'
    })
    try {
      await this.validate()
      this.notify(LifeCycleTypes.ON_FORM_SUBMIT_VALIDATE_SUCCESS)
    } catch (e) {
      this.notify(LifeCycleTypes.ON_FORM_SUBMIT_VALIDATE_FAILED)
    }
    let results: any
    try {
      if (isFn(onSubmit) && this.feedback.valid) {
        results = await onSubmit(toJS(this.values))
      }
      this.notify(LifeCycleTypes.ON_FORM_SUBMIT_SUCCESS)
    } catch (e) {
      this.feedback.update({
        code: 'SubmitError',
        type: 'error',
        messages: e
      })
      this.notify(LifeCycleTypes.ON_FORM_SUBMIT_FAILED)
      new Promise(() => {
        throw e
      })
    }
    this.setSubmitting(false)
    return results
  }

  reset = async (
    pattern: FormPathPattern | RegExp = '*',
    options?: IFieldResetOptions
  ) => {
    const tasks = []
    this.query(pattern, field => {
      tasks.push(field.reset(options))
    })
    this.notify(LifeCycleTypes.ON_FORM_RESET)
    await Promise.all(tasks)
  }

  static defaultProps: IFormProps = {
    initialValues: {}
  }

  static isForm = (node: any): node is Form => {
    if (!isFn(node.initialize)) return false
    return node?.displayName === 'Form'
  }

  static isArrayField = (node: any): node is ArrayField => {
    if (!isFn(node.initialize)) return false
    return node?.displayName === 'ArrayField'
  }

  static isObjectField = (node: any): node is ObjectField => {
    if (!isFn(node.initialize)) return false
    return node?.displayName === 'ObjectField'
  }

  static isVoidField = (node: any): node is VoidField => {
    if (!isFn(node.initialize)) return false
    return node?.displayName === 'VoidField'
  }

  static isFormState = (state: any): state is IFormState => {
    if (isFn(state.initialize)) return false
    return state?.displayName === 'Form'
  }

  static isFieldState = (state: any): state is IFieldState => {
    if (isFn(state.initialize)) return false
    return state?.displayName?.indexOf('Field') > -1
  }
}